"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/functions-have-names";
exports.ids = ["vendor-chunks/functions-have-names"];
exports.modules = {

/***/ "(ssr)/./node_modules/functions-have-names/index.js":
/*!****************************************************!*\
  !*** ./node_modules/functions-have-names/index.js ***!
  \****************************************************/
/***/ ((module) => {

eval("\nvar functionsHaveNames = function functionsHaveNames() {\n    return typeof (function f() {}).name === \"string\";\n};\nvar gOPD = Object.getOwnPropertyDescriptor;\nif (gOPD) {\n    try {\n        gOPD([], \"length\");\n    } catch (e) {\n        // IE 8 has a broken gOPD\n        gOPD = null;\n    }\n}\nfunctionsHaveNames.functionsHaveConfigurableNames = function functionsHaveConfigurableNames() {\n    if (!functionsHaveNames() || !gOPD) {\n        return false;\n    }\n    var desc = gOPD(function() {}, \"name\");\n    return !!desc && !!desc.configurable;\n};\nvar $bind = Function.prototype.bind;\nfunctionsHaveNames.boundFunctionsHaveNames = function boundFunctionsHaveNames() {\n    return functionsHaveNames() && typeof $bind === \"function\" && (function f() {}).bind().name !== \"\";\n};\nmodule.exports = functionsHaveNames;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvZnVuY3Rpb25zLWhhdmUtbmFtZXMvaW5kZXguanMiLCJtYXBwaW5ncyI6IkFBQUE7QUFFQSxJQUFJQSxxQkFBcUIsU0FBU0E7SUFDakMsT0FBTyxPQUFPLFVBQVNDLEtBQUssR0FBRUMsSUFBSSxLQUFLO0FBQ3hDO0FBRUEsSUFBSUMsT0FBT0MsT0FBT0Msd0JBQXdCO0FBQzFDLElBQUlGLE1BQU07SUFDVCxJQUFJO1FBQ0hBLEtBQUssRUFBRSxFQUFFO0lBQ1YsRUFBRSxPQUFPRyxHQUFHO1FBQ1gseUJBQXlCO1FBQ3pCSCxPQUFPO0lBQ1I7QUFDRDtBQUVBSCxtQkFBbUJPLDhCQUE4QixHQUFHLFNBQVNBO0lBQzVELElBQUksQ0FBQ1Asd0JBQXdCLENBQUNHLE1BQU07UUFDbkMsT0FBTztJQUNSO0lBQ0EsSUFBSUssT0FBT0wsS0FBSyxZQUFhLEdBQUc7SUFDaEMsT0FBTyxDQUFDLENBQUNLLFFBQVEsQ0FBQyxDQUFDQSxLQUFLQyxZQUFZO0FBQ3JDO0FBRUEsSUFBSUMsUUFBUUMsU0FBU0MsU0FBUyxDQUFDQyxJQUFJO0FBRW5DYixtQkFBbUJjLHVCQUF1QixHQUFHLFNBQVNBO0lBQ3JELE9BQU9kLHdCQUF3QixPQUFPVSxVQUFVLGNBQWMsVUFBU1QsS0FBSyxHQUFFWSxJQUFJLEdBQUdYLElBQUksS0FBSztBQUMvRjtBQUVBYSxPQUFPQyxPQUFPLEdBQUdoQiIsInNvdXJjZXMiOlsid2VicGFjazovL3YzLWFwcC8uL25vZGVfbW9kdWxlcy9mdW5jdGlvbnMtaGF2ZS1uYW1lcy9pbmRleC5qcz84ZTk3Il0sInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIGZ1bmN0aW9uc0hhdmVOYW1lcyA9IGZ1bmN0aW9uIGZ1bmN0aW9uc0hhdmVOYW1lcygpIHtcblx0cmV0dXJuIHR5cGVvZiBmdW5jdGlvbiBmKCkge30ubmFtZSA9PT0gJ3N0cmluZyc7XG59O1xuXG52YXIgZ09QRCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3I7XG5pZiAoZ09QRCkge1xuXHR0cnkge1xuXHRcdGdPUEQoW10sICdsZW5ndGgnKTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdC8vIElFIDggaGFzIGEgYnJva2VuIGdPUERcblx0XHRnT1BEID0gbnVsbDtcblx0fVxufVxuXG5mdW5jdGlvbnNIYXZlTmFtZXMuZnVuY3Rpb25zSGF2ZUNvbmZpZ3VyYWJsZU5hbWVzID0gZnVuY3Rpb24gZnVuY3Rpb25zSGF2ZUNvbmZpZ3VyYWJsZU5hbWVzKCkge1xuXHRpZiAoIWZ1bmN0aW9uc0hhdmVOYW1lcygpIHx8ICFnT1BEKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHZhciBkZXNjID0gZ09QRChmdW5jdGlvbiAoKSB7fSwgJ25hbWUnKTtcblx0cmV0dXJuICEhZGVzYyAmJiAhIWRlc2MuY29uZmlndXJhYmxlO1xufTtcblxudmFyICRiaW5kID0gRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQ7XG5cbmZ1bmN0aW9uc0hhdmVOYW1lcy5ib3VuZEZ1bmN0aW9uc0hhdmVOYW1lcyA9IGZ1bmN0aW9uIGJvdW5kRnVuY3Rpb25zSGF2ZU5hbWVzKCkge1xuXHRyZXR1cm4gZnVuY3Rpb25zSGF2ZU5hbWVzKCkgJiYgdHlwZW9mICRiaW5kID09PSAnZnVuY3Rpb24nICYmIGZ1bmN0aW9uIGYoKSB7fS5iaW5kKCkubmFtZSAhPT0gJyc7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uc0hhdmVOYW1lcztcbiJdLCJuYW1lcyI6WyJmdW5jdGlvbnNIYXZlTmFtZXMiLCJmIiwibmFtZSIsImdPUEQiLCJPYmplY3QiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJlIiwiZnVuY3Rpb25zSGF2ZUNvbmZpZ3VyYWJsZU5hbWVzIiwiZGVzYyIsImNvbmZpZ3VyYWJsZSIsIiRiaW5kIiwiRnVuY3Rpb24iLCJwcm90b3R5cGUiLCJiaW5kIiwiYm91bmRGdW5jdGlvbnNIYXZlTmFtZXMiLCJtb2R1bGUiLCJleHBvcnRzIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/functions-have-names/index.js\n");

/***/ })

};
;