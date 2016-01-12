//----------------------------------------------------------------------------------------------------------------------
// TrivialModels Gruntfile
//----------------------------------------------------------------------------------------------------------------------

module.exports = function(grunt)
{
    grunt.initConfig({
        clean: ['dist'],
        babel: {
            options: {
                sourceMap: "inline",
                presets: ['es2015']
            },
            dev: {
                options: {
                    compact: false,
                    comments: true
                },
                files: [{
                    expand: true,
                    cwd:"src",
                    src: ['**/*.js'],
                    dest: 'dist'
                }]
            },
            prod: {
                options: {
                    compact: true,
                    comments: false
                },
                files: [{
                    expand: true,
                    cwd:"src",
                    src: ['**/*.js'],
                    dest: 'dist'
                }]
            }
        },
        watch: {
            index: {
                files: ["src/**/*.js"],
                tasks: ["babel:dev"]
            }
        },
        eslint: {
            src: {
                src: ['Gruntfile.js', 'src/**/*.js'],
                options: { configFile: '.eslintrc' }
            },
            test: {
                src: ['test/**/*.js'],
                options: { configFile: 'test/.eslintrc' }
            }
        }
    });

    //------------------------------------------------------------------------------------------------------------------

    grunt.loadNpmTasks("grunt-babel");
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks("gruntify-eslint");

    //------------------------------------------------------------------------------------------------------------------

    grunt.registerTask("build-dev", ["eslint", "clean", "babel:dev"]);
    grunt.registerTask("build", ["eslint", "clean", "babel:prod"]);
    grunt.registerTask("default", ["build-dev", 'watch']);

    //------------------------------------------------------------------------------------------------------------------
};

//----------------------------------------------------------------------------------------------------------------------
