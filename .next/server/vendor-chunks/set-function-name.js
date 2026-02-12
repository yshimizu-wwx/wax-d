"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/set-function-name";
exports.ids = ["vendor-chunks/set-function-name"];
exports.modules = {

/***/ "(ssr)/./node_modules/set-function-name/index.js":
/*!*************************************************!*\
  !*** ./node_modules/set-function-name/index.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("\nvar define = __webpack_require__(/*! define-data-property */ \"(ssr)/./node_modules/define-data-property/index.js\");\nvar hasDescriptors = __webpack_require__(/*! has-property-descriptors */ \"(ssr)/./node_modules/has-property-descriptors/index.js\")();\nvar functionsHaveConfigurableNames = (__webpack_require__(/*! functions-have-names */ \"(ssr)/./node_modules/functions-have-names/index.js\").functionsHaveConfigurableNames)();\nvar $TypeError = __webpack_require__(/*! es-errors/type */ \"(ssr)/./node_modules/es-errors/type.js\");\n/** @type {import('.')} */ module.exports = function setFunctionName(fn, name) {\n    if (typeof fn !== \"function\") {\n        throw new $TypeError(\"`fn` is not a function\");\n    }\n    var loose = arguments.length > 2 && !!arguments[2];\n    if (!loose || functionsHaveConfigurableNames) {\n        if (hasDescriptors) {\n            define(/** @type {Parameters<define>[0]} */ fn, \"name\", name, true, true);\n        } else {\n            define(/** @type {Parameters<define>[0]} */ fn, \"name\", name);\n        }\n    }\n    return fn;\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvc2V0LWZ1bmN0aW9uLW5hbWUvaW5kZXguanMiLCJtYXBwaW5ncyI6IkFBQUE7QUFFQSxJQUFJQSxTQUFTQyxtQkFBT0EsQ0FBQztBQUNyQixJQUFJQyxpQkFBaUJELG1CQUFPQSxDQUFDO0FBQzdCLElBQUlFLGlDQUFpQ0Ysc0lBQThEO0FBRW5HLElBQUlHLGFBQWFILG1CQUFPQSxDQUFDO0FBRXpCLHdCQUF3QixHQUN4QkksT0FBT0MsT0FBTyxHQUFHLFNBQVNDLGdCQUFnQkMsRUFBRSxFQUFFQyxJQUFJO0lBQ2pELElBQUksT0FBT0QsT0FBTyxZQUFZO1FBQzdCLE1BQU0sSUFBSUosV0FBVztJQUN0QjtJQUNBLElBQUlNLFFBQVFDLFVBQVVDLE1BQU0sR0FBRyxLQUFLLENBQUMsQ0FBQ0QsU0FBUyxDQUFDLEVBQUU7SUFDbEQsSUFBSSxDQUFDRCxTQUFTUCxnQ0FBZ0M7UUFDN0MsSUFBSUQsZ0JBQWdCO1lBQ25CRixPQUFPLGtDQUFrQyxHQUFJUSxJQUFLLFFBQVFDLE1BQU0sTUFBTTtRQUN2RSxPQUFPO1lBQ05ULE9BQU8sa0NBQWtDLEdBQUlRLElBQUssUUFBUUM7UUFDM0Q7SUFDRDtJQUNBLE9BQU9EO0FBQ1IiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly92My1hcHAvLi9ub2RlX21vZHVsZXMvc2V0LWZ1bmN0aW9uLW5hbWUvaW5kZXguanM/ZTQ2NSJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBkZWZpbmUgPSByZXF1aXJlKCdkZWZpbmUtZGF0YS1wcm9wZXJ0eScpO1xudmFyIGhhc0Rlc2NyaXB0b3JzID0gcmVxdWlyZSgnaGFzLXByb3BlcnR5LWRlc2NyaXB0b3JzJykoKTtcbnZhciBmdW5jdGlvbnNIYXZlQ29uZmlndXJhYmxlTmFtZXMgPSByZXF1aXJlKCdmdW5jdGlvbnMtaGF2ZS1uYW1lcycpLmZ1bmN0aW9uc0hhdmVDb25maWd1cmFibGVOYW1lcygpO1xuXG52YXIgJFR5cGVFcnJvciA9IHJlcXVpcmUoJ2VzLWVycm9ycy90eXBlJyk7XG5cbi8qKiBAdHlwZSB7aW1wb3J0KCcuJyl9ICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHNldEZ1bmN0aW9uTmFtZShmbiwgbmFtZSkge1xuXHRpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0dGhyb3cgbmV3ICRUeXBlRXJyb3IoJ2BmbmAgaXMgbm90IGEgZnVuY3Rpb24nKTtcblx0fVxuXHR2YXIgbG9vc2UgPSBhcmd1bWVudHMubGVuZ3RoID4gMiAmJiAhIWFyZ3VtZW50c1syXTtcblx0aWYgKCFsb29zZSB8fCBmdW5jdGlvbnNIYXZlQ29uZmlndXJhYmxlTmFtZXMpIHtcblx0XHRpZiAoaGFzRGVzY3JpcHRvcnMpIHtcblx0XHRcdGRlZmluZSgvKiogQHR5cGUge1BhcmFtZXRlcnM8ZGVmaW5lPlswXX0gKi8gKGZuKSwgJ25hbWUnLCBuYW1lLCB0cnVlLCB0cnVlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZGVmaW5lKC8qKiBAdHlwZSB7UGFyYW1ldGVyczxkZWZpbmU+WzBdfSAqLyAoZm4pLCAnbmFtZScsIG5hbWUpO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gZm47XG59O1xuIl0sIm5hbWVzIjpbImRlZmluZSIsInJlcXVpcmUiLCJoYXNEZXNjcmlwdG9ycyIsImZ1bmN0aW9uc0hhdmVDb25maWd1cmFibGVOYW1lcyIsIiRUeXBlRXJyb3IiLCJtb2R1bGUiLCJleHBvcnRzIiwic2V0RnVuY3Rpb25OYW1lIiwiZm4iLCJuYW1lIiwibG9vc2UiLCJhcmd1bWVudHMiLCJsZW5ndGgiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/set-function-name/index.js\n");

/***/ })

};
;