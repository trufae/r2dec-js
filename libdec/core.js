/* 
 * Copyright (C) 2018 deroad
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

module.exports = (function() {
    var Base = require('libdec/core/base');
    var Block = require('libdec/core/block');
    var Scope = require('libdec/core/scope');
    var Strings = require('libdec/core/strings');
    var Instruction = require('libdec/core/instruction');

    var _post_analysis = function(data, arch, arch_context) {
        if (arch.custom_end) {
            arch.custom_end(data.instructions, arch_context)
        }
    };

    var _pre_analysis = function(data, arch, arch_context) {
        if (arch.custom_start) {
            arch.custom_start(data.instructions, arch_context)
        }
    };
    var _decompile = function(data, arch, arch_context) {
        var instructions = data.blocks[0].instructions;
        for (var i = 0; i < instructions.length; i++) {
            var instr = instructions[i];
            var fcn = arch.instructions[instr.parsed.mnem];
            instr.code = fcn ? fcn(instr, arch_context, instructions) : new Base.unknown(instr.assembly)
        }
    };
    var _print = function(data) {
        data.print();
    };

    var _prepare = function(data, arch) {
        this.blocks = [new Block()];
        this.instructions = [];
        var strings = new Strings(data.xrefs.strings)
        var max_length = 0;
        for (var i = 0; i < data.graph[0].blocks.length; i++) {
            var block = data.graph[0].blocks[i];
            this.instructions = this.instructions.concat(block.ops.map(function(b) {
                if (max_length < b.opcode.length) {
                    max_length = b.opcode.length
                }
                var ins = new Instruction(b, arch);
                ins.strings = strings.search(ins.pointer);
                return ins;
            }));
        }
        Global.context.identAsmSet(max_length);
        this.blocks[0].extra.push(new Scope.routine(this.instructions[0].location, {
            returns: 'void',
            name: data.graph[0].name,
            args: [],
            locals: []
        }));
        this.blocks[0].extra.push(new Scope.brace(this.instructions[this.instructions.length - 1].location));
        this.blocks[0].instructions = this.instructions.splice();

        this.print = function() {
            for (var i = 0; i < this.blocks.length; i++) {
                this.blocks[i].print();
            }
        };
    };

    return {
        decompile: _decompile,
        prepare: _prepare,
        analysis: {
            pre: _pre_analysis,
            post: _post_analysis
        },
        print: _print,
    };
})();