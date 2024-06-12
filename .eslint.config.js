module.exports = {
	"languageOptions": {
		"parserOptions": {
			"ecmaVersion": "latest",
			"sourceType": "module",
			"ecmaFeatures": {}
		},
		"globals": {
			"process": true,
			"BigInt": true,
			"Global": true,
			"Limits": true,
			"radare2": true,
			"atob": true,
			"btoa": true,
			"unit": true,
			"console": true
		}
	},
	//"extends": "eslint:recommended",
	"rules": {
		"semi": [2, "always"],
		"no-console": ["error", {
			"allow": ["log"]
		}],
		"no-redeclare": ["error", {
			"builtinGlobals": false
		}],
		"no-empty": ["error", {
			"allowEmptyCatch": true
		}],
		"no-unused-vars": ["error", {
			"varsIgnorePattern": "r2dec_|\\binclude\\b",
			"args": "none"
		}],
		"curly": "error",
		"no-sparse-arrays": "warn",
		"no-cond-assign": ["error", "except-parens"],
		"no-constant-condition": ["error", {
			"checkLoops": false
		}],
		"no-control-regex": "warn"
	},
};
