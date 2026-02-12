"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/is-date-object";
exports.ids = ["vendor-chunks/is-date-object"];
exports.modules = {

/***/ "(ssr)/./node_modules/is-date-object/index.js":
/*!**********************************************!*\
  !*** ./node_modules/is-date-object/index.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("\nvar callBound = __webpack_require__(/*! call-bound */ \"(ssr)/./node_modules/call-bound/index.js\");\nvar getDay = callBound(\"Date.prototype.getDay\");\n/** @type {import('.')} */ var tryDateObject = function tryDateGetDayCall(value) {\n    try {\n        getDay(value);\n        return true;\n    } catch (e) {\n        return false;\n    }\n};\n/** @type {(value: unknown) => string} */ var toStr = callBound(\"Object.prototype.toString\");\nvar dateClass = \"[object Date]\";\nvar hasToStringTag = __webpack_require__(/*! has-tostringtag/shams */ \"(ssr)/./node_modules/has-tostringtag/shams.js\")();\n/** @type {import('.')} */ module.exports = function isDateObject(value) {\n    if (typeof value !== \"object\" || value === null) {\n        return false;\n    }\n    return hasToStringTag ? tryDateObject(value) : toStr(value) === dateClass;\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvaXMtZGF0ZS1vYmplY3QvaW5kZXguanMiLCJtYXBwaW5ncyI6IkFBQUE7QUFFQSxJQUFJQSxZQUFZQyxtQkFBT0EsQ0FBQztBQUV4QixJQUFJQyxTQUFTRixVQUFVO0FBQ3ZCLHdCQUF3QixHQUN4QixJQUFJRyxnQkFBZ0IsU0FBU0Msa0JBQWtCQyxLQUFLO0lBQ25ELElBQUk7UUFDSEgsT0FBT0c7UUFDUCxPQUFPO0lBQ1IsRUFBRSxPQUFPQyxHQUFHO1FBQ1gsT0FBTztJQUNSO0FBQ0Q7QUFFQSx1Q0FBdUMsR0FDdkMsSUFBSUMsUUFBUVAsVUFBVTtBQUN0QixJQUFJUSxZQUFZO0FBQ2hCLElBQUlDLGlCQUFpQlIsbUJBQU9BLENBQUM7QUFFN0Isd0JBQXdCLEdBQ3hCUyxPQUFPQyxPQUFPLEdBQUcsU0FBU0MsYUFBYVAsS0FBSztJQUMzQyxJQUFJLE9BQU9BLFVBQVUsWUFBWUEsVUFBVSxNQUFNO1FBQ2hELE9BQU87SUFDUjtJQUNBLE9BQU9JLGlCQUFpQk4sY0FBY0UsU0FBU0UsTUFBTUYsV0FBV0c7QUFDakUiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly92My1hcHAvLi9ub2RlX21vZHVsZXMvaXMtZGF0ZS1vYmplY3QvaW5kZXguanM/Mzg5YyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBjYWxsQm91bmQgPSByZXF1aXJlKCdjYWxsLWJvdW5kJyk7XG5cbnZhciBnZXREYXkgPSBjYWxsQm91bmQoJ0RhdGUucHJvdG90eXBlLmdldERheScpO1xuLyoqIEB0eXBlIHtpbXBvcnQoJy4nKX0gKi9cbnZhciB0cnlEYXRlT2JqZWN0ID0gZnVuY3Rpb24gdHJ5RGF0ZUdldERheUNhbGwodmFsdWUpIHtcblx0dHJ5IHtcblx0XHRnZXREYXkodmFsdWUpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59O1xuXG4vKiogQHR5cGUgeyh2YWx1ZTogdW5rbm93bikgPT4gc3RyaW5nfSAqL1xudmFyIHRvU3RyID0gY2FsbEJvdW5kKCdPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nJyk7XG52YXIgZGF0ZUNsYXNzID0gJ1tvYmplY3QgRGF0ZV0nO1xudmFyIGhhc1RvU3RyaW5nVGFnID0gcmVxdWlyZSgnaGFzLXRvc3RyaW5ndGFnL3NoYW1zJykoKTtcblxuLyoqIEB0eXBlIHtpbXBvcnQoJy4nKX0gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNEYXRlT2JqZWN0KHZhbHVlKSB7XG5cdGlmICh0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnIHx8IHZhbHVlID09PSBudWxsKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHJldHVybiBoYXNUb1N0cmluZ1RhZyA/IHRyeURhdGVPYmplY3QodmFsdWUpIDogdG9TdHIodmFsdWUpID09PSBkYXRlQ2xhc3M7XG59O1xuIl0sIm5hbWVzIjpbImNhbGxCb3VuZCIsInJlcXVpcmUiLCJnZXREYXkiLCJ0cnlEYXRlT2JqZWN0IiwidHJ5RGF0ZUdldERheUNhbGwiLCJ2YWx1ZSIsImUiLCJ0b1N0ciIsImRhdGVDbGFzcyIsImhhc1RvU3RyaW5nVGFnIiwibW9kdWxlIiwiZXhwb3J0cyIsImlzRGF0ZU9iamVjdCJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/is-date-object/index.js\n");

/***/ })

};
;