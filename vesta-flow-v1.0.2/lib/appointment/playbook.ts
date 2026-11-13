/** Approved draft language derived from the nurture taxonomy and department
 * coaching. These are offers/questions, never claims about a customer's facts. */
export const MESSAGE_POLICY_VERSION='nurture-appointment-v2';
type Recipe={focus:string;question:string;values:string[]};
export const recipes:Record<string,Recipe>={
 new:{focus:'your home search',question:'What would you most like help with in your search?',values:[
  "I can help narrow your search and work out which homes are worth a closer look.",
  "We can use a short call to sort out what matters most before you spend time touring.",
  "I can help turn your search priorities into a practical next step.",
  "A quick conversation can help us focus on the homes and neighborhoods that fit your plans."]},
 conditional:{focus:'what would make a move worthwhile',question:'What would need to change for a move to make sense?',values:[
  "We can leave your plans on hold until the right conditions are in place.",
  "There is no need to move ahead before a change makes it worthwhile.",
  "I can help you think through the next step when your circumstances change.",
  "We can keep the timing in your hands and revisit the plan when it becomes useful."]},
 timing:{focus:'a plan for your preferred timing',question:'When would planning a move become useful for you?',values:[
  "We can work backward from your preferred timing so the planning does not become a rush.",
  "I can help map the steps for a future move without asking you to start a search now.",
  "A short planning conversation can separate what needs attention now from what can wait.",
  "We can build a plan around your schedule rather than move faster than you want."]},
 relocation:{focus:'your move and search schedule',question:'What arrival window would you like to plan around?',values:[
  "We can map your arrival window, neighborhoods and tour plans before you travel.",
  "I can help organize the search so your time in town is spent on the right homes.",
  "A remote planning call can help us line up priorities before an in-person visit.",
  "We can work through the moving timeline and decide what is worth seeing first."]},
 finance:{focus:'your financing questions and next steps',question:'Which financing question would be most helpful to work through first?',values:[
  "We can organize your financing questions and identify what to ask a lender before choosing homes.",
  "I can help connect your search plans with the financing questions you want answered.",
  "A short planning call can clarify which lending questions need answers before you move ahead.",
  "We can work out the next questions for a lender without assuming a rate or approval."]},
 budget:{focus:'your comfort range and search priorities',question:'What price range would feel comfortable for your search?',values:[
  "We can compare your must-haves with a price range you feel comfortable with.",
  "I can help sort out the trade-offs between price, location and space.",
  "A short conversation can help focus the search around your priorities and comfort range.",
  "We can identify where you want flexibility before spending time on homes that do not fit."]},
 inventory:{focus:'the right homes and neighborhoods',question:'Which home feature or neighborhood matters most to you?',values:[
  "We can separate your must-haves from nice-to-haves and focus the search.",
  "I can help compare neighborhoods and decide which options deserve a closer look.",
  "A short call can help us narrow the choices before planning tours.",
  "We can work through the location and home features that would make a viewing worthwhile."]},
 contingent:{focus:'the order of your sale and purchase',question:'Which part of coordinating a sale and purchase feels least clear?',values:[
  "We can map the sale and purchase together before you commit to either next step.",
  "I can help outline the sequence and the questions to resolve about timing and equity.",
  "A planning call can help identify what needs to happen first in a coordinated move.",
  "We can work through the dependencies so the buying and selling plans fit together."]},
 life:{focus:'a move around your preferred timeline',question:'When would a planning check-in be useful?',values:[
  "We can plan around the timing you choose, without getting into personal details.",
  "I can help map the practical steps whenever the timing works for you.",
  "We can keep the next conversation focused on your moving timeline and priorities.",
  "A future planning call can help you prepare at a pace that suits you."]},
 decision:{focus:'a shared plan with everyone you want involved',question:'Who would you like included in a planning conversation?',values:[
  "We can bring everyone you want involved into one conversation about priorities.",
  "A joint planning call can help align the questions before anyone commits to a next step.",
  "I can help organize the options so the people you choose can compare them together.",
  "We can use a short conversation to understand the priorities across your group."]},
 diligence:{focus:'the property questions that need checking',question:'Which property question would you like to resolve first?',values:[
  "We can list the unanswered property questions and identify who can verify them.",
  "I can help organize what needs checking before you make a property decision.",
  "A short call can help separate the information we have from what still needs verification.",
  "We can decide which questions need an inspection, a document or an expert's input."]},
 investment:{focus:'your property investment criteria',question:'What objective matters most for your next property investment?',values:[
  "We can define your criteria and the information needed to compare properties.",
  "I can help organize the questions around your investment goals and preferred approach.",
  "A strategy call can help narrow what would make a property worth evaluating.",
  "We can work through the trade-offs and due-diligence questions before choosing a next step."]},
 uncertain:{focus:'your concerns and the options available',question:'What would you want to understand before deciding whether to move?',values:[
  "We can compare the option of waiting with the steps involved in moving, without rushing a decision.",
  "I can help break the uncertainty into questions we can actually work through.",
  "A short call can focus on your concerns rather than assume you are ready to act.",
  "We can identify what information would make a next step worthwhile for you."]},
 appointment:{focus:'the details for a planning conversation',question:'What would you like us to cover when we speak?',values:[
  "We can use a short conversation to align on your priorities and the next practical step.",
  "I can help work through your questions before we decide what to do next.",
  "We can agree on what would make our conversation useful and then coordinate a time.",
  "A focused call can help us turn your questions into a plan."]},
 seller:{focus:'your selling timeline and preparation',question:'What would you most like to understand about selling your home?',values:[
  "We can work through your selling timeline, preparation and the questions behind a pricing plan.",
  "I can help outline what to prepare before deciding when to list.",
  "A short seller planning call can help put the steps in order before you make a decision.",
  "We can compare your priorities with the preparation needed for a possible sale."]},
 relationship:{focus:'any new property plans or questions',question:'Is there a property question or future plan I can help you think through?',values:[
  "I am here if a home question or a future move comes up.",
  "You do not need to be planning a move to ask me a property question.",
  "I can help you think through a new property question whenever one comes up.",
  "We can keep this as a simple check-in unless there is something you want to plan."]},
};

/** Only the existing person-bound recorded outcome is considered. Aggregate
 * report keywords, raw note bodies and message history never become intent. */
export function recordedTopic(recorded:any):string|undefined{
 const text=[recorded?.condition,recorded?.timeframe,recorded?.outcome].filter(x=>typeof x==='string').join(' ').slice(0,1200);
 const matches:[string,RegExp][]=[
  ['contingent',/\b(sell (?:first|before)|buy and sell|sale proceeds|equity)\b/i],
  ['relocation',/\b(relocat\w*|moving (?:to|from)|travel|arrival)\b/i],
  ['finance',/\b(financ\w*|mortgage|interest rate\w*|rates?|pre.?approv\w*|lender)\b/i],
  ['budget',/\b(budget|afford\w*|price range|price point)\b/i],
  ['inventory',/\b(inventory|neighbou?rhood|location|must.haves?)\b/i],
  ['decision',/\b(decision.maker|spouse|partner|family agreement)\b/i],
  ['diligence',/\b(inspection|due diligence|condition of (?:the )?(?:home|property)|property question)\b/i],
  ['investment',/\b(invest\w*|cash flow|rental yield)\b/i],
  ['uncertain',/\b(uncertain\w*|hesitat\w*|market concern\w*)\b/i],
  ['life',/\b(lease|life event)\b/i],
 ];
 const found=matches.filter(([,pattern])=>pattern.test(text));
 // Multiple topics need broker selection; no keyword-score winner is invented.
 return found.length===1?found[0][0]:undefined;
}

export function messageLanguage(pathId:string,topicPathId?:string){return recipes[topicPathId||pathId]||recipes[pathId]||recipes.new;}
export const coachingSources=[
 {id:'nurture-report',title:'Nurture outcome research · November 5, 2026',guidance:'Seventeen overlapping discovery categories; current person evidence must select the branch.'},
 {id:'buyer-flow-jan9',title:'Departments · Buyer lead-flow SOP discussion · January 9, 2026',guidance:'Appointment, listening and motivation; explain the value of a short planning call. A request is not a confirmed appointment.'},
 {id:'associate-training-mar10',title:'Departments · Associate training · March 10, 2026',guidance:'Use team communication channels; verify appointment method, address/access, links and collaborators before confirming details.'},
 {id:'partner-jan30',title:'Departments · Partner meeting · January 30, 2026',guidance:'Keep tentative scheduling distinct from confirmed; respect calendar conflicts and personal time.'},
] as const;
