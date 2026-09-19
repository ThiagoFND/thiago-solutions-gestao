import { describe,expect,it } from 'vitest';
import { timeMinutes,validateDependencies } from './projects.rules.js';
describe('project dependency and effort invariants',()=>{
 it('allows an acyclic dependency',()=>expect(()=>validateDependencies([{id:'a',dependencies:[]}],'b',['a'])).not.toThrow());
 it('rejects circular dependencies',()=>expect(()=>validateDependencies([{id:'a',dependencies:[]},{id:'b',dependencies:['a']}],'a',['b'])).toThrow());
 it('rejects unknown tasks and self references',()=>{expect(()=>validateDependencies([],'a',['unknown'])).toThrow();expect(()=>validateDependencies([],'a',['a'])).toThrow();});
 it('counts duration in explicit timezone',()=>expect(timeMinutes('2026-09-01T09:00:00-03:00','2026-09-01T10:30:00-03:00',new Date('2026-09-02'))).toBe(90));
 it('rejects negative future fractional and timezone-less durations',()=>{for(const [start,end] of [['2026-09-01T10:00:00Z','2026-09-01T09:00:00Z'],['2026-09-03T10:00:00Z','2026-09-03T11:00:00Z'],['2026-09-01T10:00:00Z','2026-09-01T10:00:30Z'],['2026-09-01T10:00:00','2026-09-01T11:00:00']])expect(()=>timeMinutes(start,end,new Date('2026-09-02'))).toThrow();});
});
