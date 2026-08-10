from __future__ import annotations
import base64, os, random, time
from typing import Any, Iterator
from urllib.parse import urljoin, urlparse
import requests

API_ORIGIN = 'https://api.followupboss.com'
BASE_URL = f'{API_ORIGIN}/v1/'

class FubApiError(RuntimeError):
    pass

class FubClient:
    def __init__(self, api_key: str | None = None, system_name: str | None = None, system_key: str | None = None, timeout: int = 45):
        self.api_key = api_key or os.getenv('FUB_API_KEY')
        if not self.api_key:
            raise FubApiError('FUB_API_KEY is required')
        token = base64.b64encode(f'{self.api_key}:'.encode()).decode()
        self.headers = {'Authorization': f'Basic {token}', 'Accept': 'application/json'}
        system_name = system_name or os.getenv('FUB_SYSTEM_NAME')
        system_key = system_key or os.getenv('FUB_SYSTEM_KEY')
        if system_name: self.headers['X-System'] = system_name
        if system_key: self.headers['X-System-Key'] = system_key
        self.timeout = timeout
        self.session = requests.Session()

    def _url(self, path_or_url: str) -> str:
        url = path_or_url if path_or_url.startswith('http') else urljoin(BASE_URL, path_or_url.lstrip('/'))
        if urlparse(url).netloc != urlparse(API_ORIGIN).netloc:
            raise FubApiError('Refused pagination URL outside Follow Up Boss')
        return url

    def get(self, path_or_url: str, params: dict[str, Any] | None = None, attempts: int = 5) -> dict[str, Any]:
        url = self._url(path_or_url)
        for attempt in range(attempts):
            try:
                response = self.session.get(url, params=params if attempt == 0 else None, headers=self.headers, timeout=self.timeout)
            except requests.RequestException as exc:
                if attempt + 1 == attempts: raise FubApiError(f'Network failure: {exc}') from exc
                time.sleep(min(30, 0.75 * (2 ** attempt) + random.random()))
                continue
            if response.ok:
                return response.json()
            if response.status_code == 429 or response.status_code >= 500:
                if attempt + 1 < attempts:
                    retry = float(response.headers.get('Retry-After') or 0)
                    time.sleep(retry or min(30, 0.75 * (2 ** attempt) + random.random()))
                    continue
            try: detail = response.json()
            except ValueError: detail = response.text
            raise FubApiError(f'FUB {response.status_code}: {detail}')
        raise FubApiError('Follow Up Boss request exhausted retries')

    def paginate(self, endpoint: str, collection: str, params: dict[str, Any] | None = None, max_pages: int = 10000) -> Iterator[tuple[list[dict[str, Any]], dict[str, Any], int]]:
        query = dict(params or {}); query.setdefault('limit', 100)
        payload = self.get(endpoint, query)
        seen: set[str] = set(); page = 0
        while True:
            page += 1
            yield list(payload.get(collection) or payload.get('data') or []), dict(payload.get('_metadata') or {}), page
            metadata = payload.get('_metadata') or {}
            next_link = metadata.get('nextLink')
            next_token = metadata.get('next')
            if page >= max_pages:
                if next_link or next_token:
                    raise FubApiError(f'Pagination stopped at max_pages={max_pages} before the collection was complete')
                return
            if next_link:
                key = str(next_link)
                if key in seen: raise FubApiError('Pagination loop detected')
                seen.add(key); payload = self.get(key); continue
            if next_token:
                key = str(next_token)
                if key in seen: raise FubApiError('Pagination token loop detected')
                seen.add(key); query['next'] = next_token; query.pop('offset', None)
                payload = self.get(endpoint, query); continue
            return
