import {useEffect, useRef} from 'react';
import {templates, type League} from './model';
import {checklistFor} from './checklists';
import {mountChecklists} from '../guide/checklist-reader.js';
import '../guide/checklist-reader.css';

export function ChecklistReader({league}: {league: League}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const checklists = templates.flatMap(task => task.variants.map(v => checklistFor(task, v)));
    mountChecklists(root.current, {tasks: templates, checklists}, league);
  }, [league]);
  return <div ref={root} className="cl-reader"/>;
}
