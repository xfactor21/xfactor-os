export type ParsedCommand =
  | {type:'riot'}
  | {type:'stack'}
  | {type:'new-incident';name?:string}
  | {type:'capture';text:string;signalType:'spark'|'task'|'note'|'link'}
  | {type:'open';target:'signal'|'piles'|'vault'|'terminal'|'lab'|'tape'|'floor'}
  | {type:'search';query:string}
  | {type:'unknown'};

export function parseCommand(raw:string):ParsedCommand {
  const value=raw.trim();
  const q=value.toLowerCase();
  if(!q)return {type:'unknown'};
  if(/^(riot|scatter|make (a )?mess)$/.test(q))return {type:'riot'};
  if(/^(stack|stack it|organize|restore order)$/.test(q))return {type:'stack'};
  const project=value.match(/^(?:new|create|throw in)\s+(?:incident|project)\s+(.+)$/i);
  if(project)return {type:'new-incident',name:project[1].trim()};
  if(/^(?:new|create)\s+(?:incident|project)$/i.test(value))return {type:'new-incident'};
  const capture=value.match(/^(capture|spark|task|note|link)\s+(.+)$/i);
  if(capture){
    const verb=capture[1].toLowerCase();
    return {type:'capture',text:capture[2].trim(),signalType:verb==='capture'?'spark':verb as 'spark'|'task'|'note'|'link'};
  }
  const open=value.match(/^(?:open|go to|show)\s+(floor|signal|piles|vault|terminal|term|lab|studio|design lab|tape|activity)$/i);
  if(open){
    const target=open[1].toLowerCase();
    return {type:'open',target:target==='term'?'terminal':target==='studio'||target==='design lab'?'lab':target==='activity'?'tape':target as 'signal'|'piles'|'vault'|'terminal'|'lab'|'tape'|'floor'};
  }
  const search=value.match(/^(?:find|search)\s+(.+)$/i);
  if(search)return {type:'search',query:search[1].trim()};
  return {type:'unknown'};
}
