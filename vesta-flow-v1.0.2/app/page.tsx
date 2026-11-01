import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import VestaFlow from '@/components/VestaFlow';
import { openSession } from '@/lib/fub/oauth';

export default async function Page(){
  const session = (await cookies()).get('vesta_fub_session')?.value;
  if (!session || !openSession(session)) redirect('/api/auth/fub/start');
  return <VestaFlow/>;
}
