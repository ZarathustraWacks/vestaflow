import { NextResponse } from 'next/server';
import { flowStorageStatus } from '@/lib/flow/store';
import { getConfig,shouldUseDemo } from '@/lib/fub/config';
export async function GET(){const config=getConfig(),storage=flowStorageStatus();return NextResponse.json({ok:true,product:'Vesta Flow',version:'1.0.0',authentication:'demo-broker-selector',operationalAuthenticationReady:false,mode:shouldUseDemo()?'demo':'live',fubConnected:Boolean(config.apiKey)&&!config.forceDemo,storage,managementAlertConfigured:Boolean(process.env.VESTA_MANAGEMENT_ALERT_WEBHOOK),followUpBossWriteback:false,capabilities:['ranked-broker-flow','structured-outcomes','scheduled-skips','management-pass-escalation','reroute','return','nurture','kill-disposition','full-lead-intelligence','immutable-action-ledger']})}
