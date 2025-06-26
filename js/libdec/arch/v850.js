// SPDX-FileCopyrightText: 2018-2023 Giovanni Dante Grazioli <deroad@libero.it>
// SPDX-License-Identifier: BSD-3-Clause

import Base from '../core/base.js';
import Variable from '../core/variable.js';

var _common_math = function(e, op, reversed) {
	if (e.opd[1] == '0') {
		return Base.nop();
	}
	if (reversed) {
		return op(e.opd[1], e.opd[0], e.opd[1]);
	}
	return op(e.opd[1], e.opd[1], e.opd[0]);
};

var _compare = function(instr, context) {
	context.cond.a = instr.parsed.opd[1];
	context.cond.b = instr.parsed.opd[0];
	return Base.nop();
};

var _conditional = function(instr, context, type, zero) {
	instr.conditional(context.cond.a, context.cond.b, type);
	return Base.nop();
};

var load_bits = function(register, pointer, bits, signed) {
	//pointer, register, bits, is_signed
	return Base.read_memory(pointer, register, bits, signed);
};

var store_bits = function(register, pointer, bits, signed) {
	//pointer, register, bits, is_signed
	return Base.write_memory(pointer, register, bits, signed);
};

var _setf_v850_cond = {
	'lt': {
		cond: 'LT',
		arg1: null,
	},
	'le': {
		cond: 'LE',
		arg1: null,
	},
	'ge': {
		cond: 'GE',
		arg1: null,
	},
	'gt': {
		cond: 'GT',
		arg1: null,
	},
	'nh': {
		cond: 'LE',
		arg1: null,
	},
	'h': {
		cond: 'GT',
		arg1: null,
	},
	'nz': {
		cond: 'NE',
		arg1: '0',
	},
	'z': {
		cond: 'EQ',
		arg1: '0',
	},
	'c': {
		cond: 'LT', // Carry flag set
		arg1: null,
	},
	'nc': {
		cond: 'GE', // Carry flag not set
		arg1: null,
	},
	'sat': {
		cond: 'NE', // Saturation flag
		arg1: '0',
	},
	'ov': {
		cond: 'NE', // Overflow flag
		arg1: '0',
	},
	'nov': {
		cond: 'EQ', // No overflow flag
		arg1: '0',
	}
};

export default {
	instructions: {
		add: function(instr) {
			return _common_math(instr.parsed, Base.add);
		},
		addi: function(instr) {
			// addi imm, reg1, reg2 => reg2 = reg1 + imm
			// Example: addi -58, tp, r0
			var imm = instr.parsed.opd[0];
			var src = instr.parsed.opd[1];
			var dst = instr.parsed.opd[2];
			
			if (dst == '0') {
				return Base.nop();
			}
			
			return Base.add(dst, src, imm);
		},
		adf: function(instr) {
			// atomic double-word fetch - load half word from memory atomically
			var addr = instr.parsed.opd[0];
			var src = instr.parsed.opd[1];
			var dst = instr.parsed.opd[2];
			if (src == '0') {
				return load_bits(dst, addr, 16, true);
			}
			return load_bits(dst, src + ' + ' + addr, 16, true);
		},
		be: function(instr, context) {
			// branch if equal - alias for beq
			return _conditional(instr, context, 'EQ');
		},
		and: function(instr) {
			return _common_math(instr.parsed, Base.and);
		},
		b: function() {
			return Base.nop();
		},
		br: function(instr) {
			// branch relative/unconditional
			return Base.nop();
		},
		bl: function(instr) {
			// branch and link
			if (instr.parsed.opd[0]) {
				if (instr.parsed.opd[0].indexOf('0x') == 0) {
					return Base.call(Variable.functionPointer(instr.parsed.opd[0]), []);
				}
				return Base.call(instr.parsed.opd[0], []);
			}
			return Base.nop();
		},
		bcond: function(instr, context) {
			// generic condition check and branch
			return _conditional(instr, context, instr.parsed.opd[0]);
		},
		bne: function(instr, context) {
			return _conditional(instr, context, 'NE');
		},
		beq: function(instr, context) {
			return _conditional(instr, context, 'EQ');
		},
		bgt: function(instr, context) {
			return _conditional(instr, context, 'GT');
		},
		bnh: function(instr, context) {
			//branch not higher = LE
			return _conditional(instr, context, 'LE');
		},
		bh: function(instr, context) {
			//branch higher = GT
			return _conditional(instr, context, 'GT');
		},
		bge: function(instr, context) {
			return _conditional(instr, context, 'GE');
		},
		blt: function(instr, context) {
			return _conditional(instr, context, 'LT');
		},
		ble: function(instr, context) {
			return _conditional(instr, context, 'LE');
		},
		bz: function(instr, context) {
			return _conditional(instr, context, 'EQ');
		},
		bnz: function(instr, context) {
			return _conditional(instr, context, 'NE');
		},
		cmp: _compare,
		cmov: function(instr, context) {
			// conditional move
			// cmov c, r1, r2, r3: if (c) r3 = r2; else r3 = r1;
			var cond = instr.parsed.opd[0];
			var src1 = instr.parsed.opd[1];
			var src2 = instr.parsed.opd[2];
			var dst = instr.parsed.opd[3];
			var o = _setf_v850_cond[cond];
			if (!o) {
				instr.comments.push('unhandled cmov condition: ' + cond);
				return Base.assign(dst, src1);
			}
			return Base.conditional_assign(dst, context.cond.a, o.arg1 || context.cond.b, o.cond, src2, src1);
		},
		'cmovf.d': function(instr, context) {
			// conditional move float double
			// cmovf.d c, r1, r2, r3: if (c) r3 = r2; else r3 = r1;
			var cond = instr.parsed.opd[0];
			var src1 = instr.parsed.opd[1];
			var src2 = instr.parsed.opd[2];
			var dst = instr.parsed.opd[3];
			var o = _setf_v850_cond[cond];
			if (!o) {
				instr.comments.push('unhandled cmovf.d condition: ' + cond);
				return Base.assign(dst, src1);
			}
			return Base.conditional_assign(dst, context.cond.a, o.arg1 || context.cond.b, o.cond, src2, src1);
		},
		'cmovf.s': function(instr, context) {
			// conditional move float single
			// cmovf.s c, r1, r2, r3: if (c) r3 = r2; else r3 = r1;
			var cond = instr.parsed.opd[0];
			var src1 = instr.parsed.opd[1];
			var src2 = instr.parsed.opd[2];
			var dst = instr.parsed.opd[3];
			var o = _setf_v850_cond[cond];
			if (!o) {
				instr.comments.push('unhandled cmovf.s condition: ' + cond);
				return Base.assign(dst, src1);
			}
			return Base.conditional_assign(dst, context.cond.a, o.arg1 || context.cond.b, o.cond, src2, src1);
		},
		dispose: function(instr, context) {
			// Stack frame cleanup and return
			// dispose list-of-reg, imm16 (optional)
			// Restore saved registers from stack and deallocate stack frame
			context.leave = true;
			return Base.nop();
		},
		jarl: function(instr, context, instructions) {
			if (instr.parsed.opd[1] == '0') {
				instr.comments.push('link pointer is lost. (used r0)');
			} else {
				instr.comments.push(instr.parsed.opd[1] + ' = PC + 4;');
			}
			var arg = instr.parsed.opd[0];
			if (instr.parsed.opd[0].indexOf('0x') == 0) {
				arg = Variable.functionPointer(arg);
			}
			return Base.call(arg, []);
		},
		jmp: function(instr, context, instructions) {
			if ((instructions.length - 1) == instructions.indexOf(instr)) {
				//name, args, is_pointer, returns, bits
				return Base.call(instr.parsed.opd[0], [], true, 'return');
			}
			return Base.nop();
		},
		div: function(instr) {
			// signed division
			if (instr.parsed.opd.length == 2) {
				return Base.divide(instr.parsed.opd[0], instr.parsed.opd[0], instr.parsed.opd[1]);
			}
			return Base.divide(instr.parsed.opd[2], instr.parsed.opd[1], instr.parsed.opd[0]);
		},
		divu: function(instr) {
			// unsigned division
			if (instr.parsed.opd.length == 2) {
				return Base.divide(instr.parsed.opd[0], instr.parsed.opd[0], instr.parsed.opd[1]);
			}
			return Base.divide(instr.parsed.opd[2], instr.parsed.opd[1], instr.parsed.opd[0]);
		},
		jr: function() {
			return Base.nop();
		},
		'ld.b': function(instr) {
			// ld.b instruction - load signed byte
			// Format: ld.b disp[reg1], reg2  ->  reg2 = *(int8_t*)(reg1 + disp)

			// If we have a combined format like "disp[reg], dst"
			if (instr.parsed.opd.length == 2) {
				var memAddr = instr.parsed.opd[0];
				var dst = instr.parsed.opd[1];
				
				// Check if we have something like "disp[reg]" format
				var match = memAddr.match(/(.+)\[(.+)\]/);
				if (match) {
					var disp = match[1];
					var reg = match[2];
					return load_bits(dst, reg + ' + ' + disp, 8, true);
				}
				
				// If no match, just use the address directly
				return load_bits(dst, memAddr, 8, true);
			}
			
			// Standard three-operand format: ld.b addr, reg1, reg2
			var addr = instr.parsed.opd[0];
			var src = instr.parsed.opd[1];
			var dst = instr.parsed.opd[2];
			
			if (src == '0') {
				return load_bits(dst, addr, 8, true);
			}
			return load_bits(dst, src + ' + ' + addr, 8, true);
		},
		'ld.bu': function(instr) {
			// ld.bu instruction - load unsigned byte
			// Format: ld.bu disp[reg1], reg2  ->  reg2 = *(uint8_t*)(reg1 + disp)

			// If we have a combined format like "disp[reg], dst"
			if (instr.parsed.opd.length == 2) {
				var memAddr = instr.parsed.opd[0];
				var dst = instr.parsed.opd[1];
				
				// Check if we have something like "disp[reg]" format
				var match = memAddr.match(/(.+)\[(.+)\]/);
				if (match) {
					var disp = match[1];
					var reg = match[2];
					return load_bits(dst, reg + ' + ' + disp, 8, false);
				}
				
				// If no match, just use the address directly
				return load_bits(dst, memAddr, 8, false);
			}
			
			// Standard three-operand format: ld.bu addr, reg1, reg2
			var addr = instr.parsed.opd[0];
			var src = instr.parsed.opd[1];
			var dst = instr.parsed.opd[2];
			
			if (src == '0') {
				return load_bits(dst, addr, 8, false);
			}
			return load_bits(dst, src + ' + ' + addr, 8, false);
		},
		'ld.h': function(instr) {
			// ld.h instruction - load signed halfword
			// Format: ld.h disp[reg1], reg2  ->  reg2 = *(int16_t*)(reg1 + disp)

			// If we have a combined format like "disp[reg], dst"
			if (instr.parsed.opd.length == 2) {
				var memAddr = instr.parsed.opd[0];
				var dst = instr.parsed.opd[1];
				
				// Check if we have something like "disp[reg]" format
				var match = memAddr.match(/(.+)\[(.+)\]/);
				if (match) {
					var disp = match[1];
					var reg = match[2];
					return load_bits(dst, reg + ' + ' + disp, 16, true);
				}
				
				// If no match, just use the address directly
				return load_bits(dst, memAddr, 16, true);
			}
			
			// Standard three-operand format: ld.h addr, reg1, reg2
			var addr = instr.parsed.opd[0];
			var src = instr.parsed.opd[1];
			var dst = instr.parsed.opd[2];
			
			if (src == '0') {
				return load_bits(dst, addr, 16, true);
			}
			return load_bits(dst, src + ' + ' + addr, 16, true);
		},
		'ld.hu': function(instr) {
			// ld.hu instruction - load unsigned halfword
			// Format: ld.hu disp[reg1], reg2  ->  reg2 = *(uint16_t*)(reg1 + disp)
			// Example: ld.hu 12128[lp], lp

			// If we have only two operands, the format is likely "disp[reg1], reg2"
			if (instr.parsed.opd.length == 2) {
				var memAddr = instr.parsed.opd[0]; // This could be a combined address+register like "12128[lp]"
				var dst = instr.parsed.opd[1];
				
				// Check if we have something like "12128[lp]" format
				var match = memAddr.match(/(.+)\[(.+)\]/);
				if (match) {
					var disp = match[1];
					var reg = match[2];
					return load_bits(dst, reg + ' + ' + disp, 16, false);
				}
				
				// If no match, just use the address directly
				return load_bits(dst, memAddr, 16, false);
			}
			
			// Standard three-operand format: ld.hu addr, reg1, reg2
			var addr = instr.parsed.opd[0];
			var src = instr.parsed.opd[1];
			var dst = instr.parsed.opd[2];
			
			if (src == '0') {
				return load_bits(dst, addr, 16, false);
			}
			return load_bits(dst, src + ' + ' + addr, 16, false);
		},
		'ld.w': function(instr) {
			// ld.w instruction - load word (32-bit)
			// Format: ld.w disp[reg1], reg2  ->  reg2 = *(int32_t*)(reg1 + disp)

			// If we have a combined format like "disp[reg], dst"
			if (instr.parsed.opd.length == 2) {
				var memAddr = instr.parsed.opd[0];
				var dst = instr.parsed.opd[1];
				
				// Check if we have something like "disp[reg]" format
				var match = memAddr.match(/(.+)\[(.+)\]/);
				if (match) {
					var disp = match[1];
					var reg = match[2];
					return load_bits(dst, reg + ' + ' + disp, 32, false);
				}
				
				// If no match, just use the address directly
				return load_bits(dst, memAddr, 32, false);
			}
			
			// Standard three-operand format: ld.w addr, reg1, reg2
			var addr = instr.parsed.opd[0];
			var src = instr.parsed.opd[1];
			var dst = instr.parsed.opd[2];
			
			if (src == '0') {
				return load_bits(dst, addr, 32, false);
			}
			return load_bits(dst, src + ' + ' + addr, 32, false);
		},
		'ld.dw': function(instr) {
			// ld.dw instruction - load double word (64-bit)
			// Format: ld.dw disp[reg1], reg2  ->  reg2 = *(int64_t*)(reg1 + disp)

			// If we have a combined format like "disp[reg], dst"
			if (instr.parsed.opd.length == 2) {
				var memAddr = instr.parsed.opd[0];
				var dst = instr.parsed.opd[1];
				
				// Check if we have something like "disp[reg]" format
				var match = memAddr.match(/(.+)\[(.+)\]/);
				if (match) {
					var disp = match[1];
					var reg = match[2];
					return load_bits(dst, reg + ' + ' + disp, 64, false);
				}
				
				// If no match, just use the address directly
				return load_bits(dst, memAddr, 64, false);
			}
			
			// Standard three-operand format: ld.dw addr, reg1, reg2
			var addr = instr.parsed.opd[0];
			var src = instr.parsed.opd[1];
			var dst = instr.parsed.opd[2];
			
			if (src == '0') {
				return load_bits(dst, addr, 64, false);
			}
			return load_bits(dst, src + ' + ' + addr, 64, false);
		},
		mov: function(instr) {
			if (instr.parsed.opd[1] == '0') {
				return Base.nop();
			}
			return Base.assign(instr.parsed.opd[1], instr.parsed.opd[0]);
		},
		movea: function(instr) {
			if (instr.parsed.opd[2] == '0') {
				return Base.nop();
			}
			if (instr.parsed.opd[1] == '0') {
				return Base.assign(instr.parsed.opd[2], instr.parsed.opd[0]);
			}
			if (instr.parsed.opd[0] == '0') {
				return Base.assign(instr.parsed.opd[2], instr.parsed.opd[1]);
			}
			return Base.add(instr.parsed.opd[2], instr.parsed.opd[1], instr.parsed.opd[0]);
		},
		movhi: function(instr) {
			// movhi imm, gp, reg -> load high bits with immediate
			// Example: movhi -383, gp, r8 (r8 = gp + (-383 << 16))
			if (instr.parsed.opd.length == 3) {
				// Three-operand format: movhi imm, reg1, reg2
				var imm = instr.parsed.opd[0];
				var src = instr.parsed.opd[1];
				var dst = instr.parsed.opd[2];
				
				if (dst == '0') {
					return Base.nop();
				}
				
				// Convert immediate to proper hex representation
				var immValue = parseInt(imm);
				var hexValue;
				
				// Handle both positive and negative values correctly
				if (immValue < 0) {
					// For negative values, we want the correct two's complement representation
					// Limited to 16 bits (since it's a high immediate)
					var val = (immValue & 0xFFFF) << 16;
					hexValue = '0x' + val.toString(16);
				} else {
					hexValue = '0x' + immValue.toString(16) + '0000';
				}
				
				if (src == '0') {
					return Base.assign(dst, hexValue);
				}
				
				// Add the base register to the shifted immediate
				return Base.add(dst, src, hexValue);
			}
			
			// Two-operand format (movhi imm, reg)
			if (instr.parsed.opd[1] == '0') {
				return Base.nop();
			}
			
			var a = instr.parsed.opd[0];
			var immValue = parseInt(a);
			var hexValue;
			
			if (immValue < 0) {
				// For negative values, we want the correct two's complement representation
				var val = (immValue & 0xFFFF) << 16;
				hexValue = '0x' + val.toString(16);
			} else {
				if (a.indexOf('0x') != 0) {
					hexValue = '0x' + immValue.toString(16) + '0000';
				} else {
					hexValue = a + '0000';
				}
			}
			
			return Base.assign(instr.parsed.opd[1], hexValue);
		},
		mul: function(instr) {
			if (instr.parsed.opd[2] == '0') {
				return Base.nop();
			}
			//value, bits, is_signed, is_pointer, is_memory
			var n = Variable.local(instr.parsed.opd[0], 32, true);
			return Base.multiply(instr.parsed.opd[2], instr.parsed.opd[1], n);
		},
		mulh: function(instr) {
			if (instr.parsed.opd[1] == '0') {
				return Base.nop();
			}
			return Base.multiply(instr.parsed.opd[1], instr.parsed.opd[1], instr.parsed.opd[0]);
		},
		mulhi: function(instr) {
			if (instr.parsed.opd[2] == '0') {
				return Base.nop();
			}
			return Base.multiply(instr.parsed.opd[2], instr.parsed.opd[1], instr.parsed.opd[0]);
		},
		not: function(instr) {
			if (instr.parsed.opd[1] == '0') {
				return Base.nop();
			}
			return Base.not(instr.parsed.opd[1], instr.parsed.opd[0]);
		},
		nop: function(instr) {
			return Base.nop();
		},
		or: function(instr) {
			return _common_math(instr.parsed, Base.or);
		},
		ori: function(instr) {
			if (instr.parsed.opd[2] == '0') {
				return Base.nop();
			}
			return Base.or(instr.parsed.opd[2], instr.parsed.opd[1], instr.parsed.opd[0]);
		},
		prepare: function(instr, context) {
			// Stack frame setup
			// prepare list-of-reg, imm16 (optional)
			// Allocate stack frame and save registers
			return Base.nop();
		},
		satadd: function(instr) {
			// add with previous carry
			return _common_math(instr.parsed, Base.add);
		},
		satsub: function(instr) {
			// add with previous carry
			return _common_math(instr.parsed, Base.subtract, false);
		},
		satsubi: function(instr) {
			// add with previous carry
			return _common_math(instr.parsed, Base.subtract, true);
		},
		satsubr: function(instr) {
			// add with previous carry
			return _common_math(instr.parsed, Base.subtract, true);
		},
		shl: function(instr) {
			return _common_math(instr.parsed, Base.shift_left);
		},
		shr: function(instr) {
			//logically shift right
			return _common_math(instr.parsed, Base.shift_right);
		},
		setf: function(instr, context) {
			var e = instr.parsed;
			if (e.opd[1] == '0') {
				return Base.nop();
			}
			if (e.opd[0] == 'v' || e.opd[0] == 'nv') {
				var m = new Variable.macro((e.opd[0] == 'nv' ? '!' : '') + 'IS_OVERFLOW(' + context.cond.a + ', ' + context.cond.b + ')');
				var op = Base.conditional_assign(e.opd[1], m, null, 'CUST', '1', '0');
				Global().context.addMacro('#define IS_OVERFLOW(a,b) (((a<0)&&(b<0)&&(a+b>0))||((a>0)&&(b>0)&&(a+b<0)))');
				return op;
			}
			var o = _setf_v850_cond[e.opd[0]];
			if (!o) {
				instr.comments.push('unhandled use-case. please report it.');
				instr.comments.push(instr.assembly);
				return Base.nop();
			}
			return Base.conditional_assign(e.opd[1], context.cond.a, o.arg1 || context.cond.b, o.cond, '1', '0');
		},
		'sld.b': function(instr) {
			var addr = instr.parsed.opd[0];
			var src = instr.parsed.opd[1];
			var dst = instr.parsed.opd[2];
			if (src == '0') {
				return load_bits(dst, addr, 8, true);
			}
			return load_bits(dst, src + ' + ' + addr, 8, true);
		},
		'sld.bu': function(instr) {
			var addr = instr.parsed.opd[0];
			var src = instr.parsed.opd[1];
			var dst = instr.parsed.opd[2];
			if (src == '0') {
				return load_bits(dst, addr, 8, false);
			}
			return load_bits(dst, src + ' + ' + addr, 8, false);
		},
		'sld.h': function(instr) {
			var addr = instr.parsed.opd[0];
			var src = instr.parsed.opd[1];
			var dst = instr.parsed.opd[2];
			if (src == '0') {
				return load_bits(dst, addr, 16, true);
			}
			return load_bits(dst, src + ' + ' + addr, 16, true);
		},
		'sld.hu': function(instr) {
			var addr = instr.parsed.opd[0];
			var src = instr.parsed.opd[1];
			var dst = instr.parsed.opd[2];
			if (src == '0') {
				return load_bits(dst, addr, 16, false);
			}
			return load_bits(dst, src + ' + ' + addr, 16, false);
		},
		'sld.w': function(instr) {
			var addr = instr.parsed.opd[0];
			var src = instr.parsed.opd[1];
			var dst = instr.parsed.opd[2];
			if (src == '0') {
				return load_bits(dst, addr, 32, false);
			}
			return load_bits(dst, src + ' + ' + addr, 32, false);
		},
		'sst.b': function(instr) {
			// st.X , r14, 0x6c36[r4]
			// ["st.X","r14","0x6c36","r4"]
			var dst = instr.parsed.opd[0];
			var addr = instr.parsed.opd[1];
			var src = instr.parsed.opd[2];
			if (src == '0') {
				return store_bits(dst, addr, 8, true);
			}
			return store_bits(dst, src + ' + ' + addr, 8, true);
		},
		'sst.bu': function(instr) {
			var dst = instr.parsed.opd[0];
			var addr = instr.parsed.opd[1];
			var src = instr.parsed.opd[2];
			if (src == '0') {
				return store_bits(dst, addr, 8, false);
			}
			return store_bits(dst, src + ' + ' + addr, 8, false);
		},
		'sst.h': function(instr) {
			var dst = instr.parsed.opd[0];
			var addr = instr.parsed.opd[1];
			var src = instr.parsed.opd[2];
			if (src == '0') {
				return store_bits(dst, addr, 16, true);
			}
			return store_bits(dst, src + ' + ' + addr, 16, true);
		},
		'sst.hu': function(instr) {
			var dst = instr.parsed.opd[0];
			var addr = instr.parsed.opd[1];
			var src = instr.parsed.opd[2];
			if (src == '0') {
				return store_bits(dst, addr, 16, false);
			}
			return store_bits(dst, src + ' + ' + addr, 16, false);
		},
		'sst.w': function(instr) {
			var dst = instr.parsed.opd[0];
			var addr = instr.parsed.opd[1];
			var src = instr.parsed.opd[2];
			if (src == '0') {
				return store_bits(dst, addr, 32, false);
			}
			return store_bits(dst, src + ' + ' + addr, 32, false);
		},
		'st.b': function(instr) {
			// st.X , r14, 0x6c36[r4]
			// ["st.X","r14","0x6c36","r4"]
			var dst = instr.parsed.opd[0];
			var addr = instr.parsed.opd[1];
			var src = instr.parsed.opd[2];
			if (src == '0') {
				return store_bits(dst, addr, 8, true);
			}
			return store_bits(dst, src + ' + ' + addr, 8, true);
		},
		'st.bu': function(instr) {
			var dst = instr.parsed.opd[0];
			var addr = instr.parsed.opd[1];
			var src = instr.parsed.opd[2];
			if (src == '0') {
				return store_bits(dst, addr, 8, false);
			}
			return store_bits(dst, src + ' + ' + addr, 8, false);
		},
		'st.h': function(instr) {
			var dst = instr.parsed.opd[0];
			var addr = instr.parsed.opd[1];
			var src = instr.parsed.opd[2];
			if (src == '0') {
				return store_bits(dst, addr, 16, true);
			}
			return store_bits(dst, src + ' + ' + addr, 16, true);
		},
		'st.hu': function(instr) {
			var dst = instr.parsed.opd[0];
			var addr = instr.parsed.opd[1];
			var src = instr.parsed.opd[2];
			if (src == '0') {
				return store_bits(dst, addr, 16, false);
			}
			return store_bits(dst, src + ' + ' + addr, 16, false);
		},
		'st.w': function(instr) {
			var dst = instr.parsed.opd[0];
			var addr = instr.parsed.opd[1];
			var src = instr.parsed.opd[2];
			if (src == '0') {
				return store_bits(dst, addr, 32, false);
			}
			return store_bits(dst, src + ' + ' + addr, 32, false);
		},
		'st.dw': function(instr) {
			// Store double word
			var dst = instr.parsed.opd[0];
			var addr = instr.parsed.opd[1];
			var src = instr.parsed.opd[2];
			if (src == '0') {
				return store_bits(dst, addr, 64, false);
			}
			return store_bits(dst, src + ' + ' + addr, 64, false);
		},
		'astore.w': function(instr) {
			// Atomic store word
			var dst = instr.parsed.opd[0];
			var addr = instr.parsed.opd[1];
			var src = instr.parsed.opd[2];
			if (src == '0') {
				return store_bits(dst, addr, 32, false);
			}
			return store_bits(dst, src + ' + ' + addr, 32, false);
		},
		sub: function(instr) {
			return _common_math(instr.parsed, Base.subtract);
		},
		stc: function(instr) {
			// store with compare
			// stc.w r1, disp16 [reg1], reg3
			var src = instr.parsed.opd[0];
			var addr = instr.parsed.opd[1];
			var reg = instr.parsed.opd[2];
			var dst = instr.parsed.opd[3];
			if (!dst) {
				// Handle 2-operand form
				dst = reg;
				reg = '0';
			}
			if (reg == '0') {
				return Base.composed([
					store_bits(src, addr, 32, false),
					Base.assign(dst, '0')  // Success status
				]);
			}
			return Base.composed([
				store_bits(src, reg + ' + ' + addr, 32, false),
				Base.assign(dst, '0')  // Success status
			]);
		},
		ldc: function(instr) {
			// load with compare
			// ldc.w disp16 [reg1], reg2
			var addr = instr.parsed.opd[0];
			var src = instr.parsed.opd[1];
			var dst = instr.parsed.opd[2];
			if (src == '0') {
				return load_bits(dst, addr, 32, false);
			}
			return load_bits(dst, src + ' + ' + addr, 32, false);
		},
		subr: function(instr) {
			return _common_math(instr.parsed, Base.subtract, true);
		},
		sxb: function(instr) {
			// Sign extend byte to 32-bit
			if (instr.parsed.opd.length == 1) {
				// Single operand form: sxb r1
				return Base.cast(instr.parsed.opd[0], instr.parsed.opd[0], 'int8_t');
			}
			// Two operand form: sxb r1, r2
			if (instr.parsed.opd[1] == '0') {
				return Base.nop();
			}
			return Base.cast(instr.parsed.opd[1], instr.parsed.opd[0], 'int8_t');
		},
		sxh: function(instr) {
			// Sign extend halfword to 32-bit
			if (instr.parsed.opd.length == 1) {
				// Single operand form: sxh r1
				return Base.cast(instr.parsed.opd[0], instr.parsed.opd[0], 'int16_t');
			}
			// Two operand form: sxh r1, r2
			if (instr.parsed.opd[1] == '0') {
				return Base.nop();
			}
			return Base.cast(instr.parsed.opd[1], instr.parsed.opd[0], 'int16_t');
		},
		tst: function(instr, context, instructions) {
			var e = instr.parsed;
			context.cond.a = (e.opd[0] == e.opd[1]) ? e.opd[1] : "(" + e.opd[1] + " & " + e.opd[0] + ")";
			context.cond.b = '0';
			return Base.nop();
		},
		xor: function(instr) {
			return _common_math(instr.parsed, Base.xor);
		},
		xori: function(instr) {
			if (instr.parsed.opd[2] == '0') {
				return Base.nop();
			}
			return Base.xor(instr.parsed.opd[2], instr.parsed.opd[1], instr.parsed.opd[0]);
		},
		zxb: function(instr) {
			// Zero extend byte to 32-bit
			if (instr.parsed.opd.length == 1) {
				// Single operand form: zxb r1
				// Create a uint8_t cast to zero-extend the register
				return Base.cast(instr.parsed.opd[0], instr.parsed.opd[0], 'uint8_t');
			}
			// Two operand form: zxb r1, r2
			if (instr.parsed.opd[1] == '0') {
				return Base.nop();
			}
			// Create a cast using the Base.cast method directly
			return Base.cast(instr.parsed.opd[1], instr.parsed.opd[0], 'uint8_t');
		},
		zxh: function(instr) {
			// Zero extend halfword to 32-bit
			if (instr.parsed.opd.length == 1) {
				// Single operand form: zxh r1
				// Create a uint16_t cast to zero-extend the register
				return Base.cast(instr.parsed.opd[0], instr.parsed.opd[0], 'uint16_t');
			}
			// Two operand form: zxh r1, r2
			if (instr.parsed.opd[1] == '0') {
				return Base.nop();
			}
			// Create a cast using the Base.cast method directly
			return Base.cast(instr.parsed.opd[1], instr.parsed.opd[0], 'uint16_t');
		},
		invalid: function() {
			return Base.nop();
		},
		andi: function(instr) {
			if (instr.parsed.opd.length == 2) {
				return Base.and(instr.parsed.opd[0], instr.parsed.opd[0], instr.parsed.opd[1]);
			} 
			return Base.and(instr.parsed.opd[2], instr.parsed.opd[1], instr.parsed.opd[0]);
		},
		bit: function(instr) {
			// Test bit instruction
			var bit = instr.parsed.opd[0];
			var reg = instr.parsed.opd[1];
			return Base.and('flag_Z', '(1 << ' + bit + ')', reg);
		},
		clr1: function(instr) {
			// Clear bit instruction
			var bit = instr.parsed.opd[0];
			var reg = instr.parsed.opd[1];
			return Base.and(reg, reg, '~(1 << ' + bit + ')');
		},
		set1: function(instr) {
			// Set bit instruction
			var bit = instr.parsed.opd[0];
			var reg = instr.parsed.opd[1];
			return Base.or(reg, reg, '(1 << ' + bit + ')');
		}
	},
	parse: function(assembly) {
		// First, handle the common case where the v850 has instructions like "ld.hu 12128[lp], lp"
		// We'll convert this to a format our parse logic can handle better:
		// "ld.hu 12128[lp] lp" (removing the comma)
		
		// The original regex for parsing was removing brackets and replacing them with spaces,
		// which causes instructions like "ld.hu 12128[lp], lp" to be incorrectly parsed as
		// "ld.hu 12128 lp lp", producing 3 operands rather than 2.
		
		// First, standardize commas with spaces
		var ret = assembly.replace(/,/g, ' ');
		
		// Replace curly braces with spaces
		ret = ret.replace(/\{|\}/g, ' ');
		
		// Remove duplicate spaces
		ret = ret.replace(/\s+/g, ' ');
		
		// Replace more zero registers
		ret = ret.trim()
			.replace(/\br0\b/g, '0')
			.replace(/\bzr\b/g, '0')
			.replace(/\bgr0\b/g, '0')
			.split(' ');
			
		// Extract mnemonic
		var mnem = ret.shift();
		
		// Process the operands while keeping memory references intact
		var operands = [];
		for (var i = 0; i < ret.length; i++) {
			var operand = ret[i];
			operands.push(operand);
		}

		return {
			mnem: mnem,
			opd: operands
		};
	},
	context: function() {
		return {
			cond: {
				a: '?',
				b: '?'
			},
			leave: false,
			vars: []
		};
	},
	localvars: function(context) {
		return [];
	},
	globalvars: function(context) {
		return [];
	},
	arguments: function(context) {
		return [];
	},
	returns: function(context) {
		return 'void';
	}
};