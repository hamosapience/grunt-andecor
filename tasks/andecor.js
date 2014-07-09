/*
 * grunt-andecor
 * https://github.com/kalle/andecor
 *
 * Copyright (c) 2014 Valentine Kamenek
 * Licensed under the MIT license.
 */
'use strict';

var esprima = require('esprima');
var escodegen = require('escodegen');


module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('andecor', 'Code decoration via comment annot', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      punctuation: '.',
      separator: ', '
    });

    // Iterate over all specified file groups.
    this.files.forEach(function(f) {
      // Concat specified files.
      var src = f.src.filter(function(filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      }).map(function(filepath) {

        var code = grunt.file.read(filepath);

        var parsed = esprima.parse(code, {
            attachComment: true
        });

        var wrapped = JSON.parse(JSON.stringify(parsed));

        for (var i = 0; i < parsed.body.length; i++){
            var token = parsed.body[i];
            if (token.type === 'ExpressionStatement' &&
                token.expression.type === 'CallExpression' &&
                token.trailingComments &&
                token.trailingComments.length){

                var callName = token.expression.callee.name;

                if (token.trailingComments[0].value.indexOf("@time") !== -1){
                    wrapped.body.splice(i, 0, esprima.parse('console.time(' + callName + ');').body[0]);
                    wrapped.body.splice(i + 2, 0, esprima.parse('console.timeEnd(' + callName + ');').body[0]);
                }
                if (token.trailingComments[0].value.indexOf("@profile") !== -1){
                    wrapped.body.splice(i, 0, esprima.parse('console.profile(' + callName + ');').body[0]);
                    wrapped.body.splice(i + 2, 0, esprima.parse('console.profileEnd(' + callName + ');').body[0]);
                }
            }
        }

        var newCode = escodegen.generate(wrapped);

        console.log(newCode);

        // Read file source.
        return newCode;
      }).join(grunt.util.normalizelf(options.separator));

      // Handle options.
      src += options.punctuation;

      // Write the destination file.
      grunt.file.write(f.dest, src);

      // Print a success message.
      grunt.log.writeln('File "' + f.dest + '" created.');
    });
  });

};
