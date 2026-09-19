import { describe, expect, it } from 'vitest';
import { toMicros } from './inventory.service.js';
describe('ingredient fixed-point quantities',()=>{
 it.each([[0.000001,1],[1.123456,1123456],[0.1,100000],[1000000,1e12]])('converts %s without binary rounding drift',(quantity,expected)=>{expect(toMicros(quantity)).toBe(expected);});
 it.each([-1,NaN,Infinity,0.0000001,0.0000000001,1.1234567,1000001])('rejects invalid or unrepresentable %s',value=>{expect(()=>toMicros(value)).toThrow();});
});
