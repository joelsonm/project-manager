const _ = require('lodash');
const exec = require('sync-exec');
const program = require('commander');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
const Storage = require('node-storage');
const commands = require('./commands.js');
const emptyDir = require('empty-dir');

var store = new Storage(__dirname+'/../config/.schema');

program.description('Gerenciador de projetos');
program.command('list').alias('l').description('Lista de projetos').action(() => {
    if(store.get('projects') == undefined){
        console.log();
        console.log(colors.yellow('Nenhum projeto definido'));
        process.exit(0);
    }
    _.each(store.get('projects'), p => {
        console.log('\nProjeto\t\t\tDiretório');
        console.log(colors.green(p.name)+'\t\t\t'+colors.yellow(p.directory));
    });
});
program.command('upgrade').alias('u').description('Atualiza projeto').action(() => {
    var projects = [];
    _.each(store.get('projects'), (p) => {
        var dir = __dirname+'/../repo/'+p.name;
        var git_tag = exec('git ls-remote --tags '+p.remote);
        if(git_tag.status == 0){
            var tags = _.filter(_.split(git_tag.stdout, /\n/g), (v) => {
                return !_.isEmpty(v);
            });
            tags = _.map(tags, (t) => {
                var tag = _.split(t, /\t/g);

                if (tag.length == 2) {
                    return {name: _.split(tag[1], '/')[2]};
                }
                return {name: tag[0]};
            });
            projects.push({name: p.name, tags: tags, remote: p.remote, directory: p.directory});
        }
    })

    inquirer.prompt([
        {
            message: "Selecione o projeto:",
            type: "list",
            name: "name",
            choices: _.map(store.get('projects'), (i) => {
                return {name: i.name, tags: i.tags, remote: i.remote, directory: i.directory};
            })
        }
    ]).then(question => {
        var proj = _.find(projects, p => {
            return p.name == question.name
        });
        proj.tags = _.orderBy(proj.tags, 'name', 'desc');
        inquirer.prompt([
            {
                message: "Selecione a versão:",
                type: "list",
                name: "tag",
                choices: _.map(proj.tags, (t, index) => {
                    var current_version = exec('cd '+proj.directory+' && type .version');
                    var disabled = true;
                    var tag = t.name +' '+colors.yellow('(Versão Atual)');
                    if (current_version.status == 0 && _.replace(current_version.stdout,' \r\n','') != t.name || current_version.status != 0) {
                        disabled = false;
                        tag = index == 0 ? t.name +' '+colors.green('(Versão recente)') : t.name;
                    }
                    return {name: tag, value: t.name,disabled: disabled};
                })
            }
        ]).then(tagselect => {
            var tmp_folder = __dirname+'/../tmp/'+proj.name;
            var clean_folder = exec('rm -rf '+tmp_folder);
            if (clean_folder.status != 0) {
                console.log(colors.white.bgRed('Erro: ')+clean_folder.stderr);
                process.exit(0);
            }
            var download = commands.download_project(proj.remote, tagselect.tag, tmp_folder);
            if (download.status == 0) {
                var limp = exec('rm -rf '+tmp_folder+'/.git');
            }
            var clean_folder_project = commands.clean_project(proj.directory);
            if (clean_folder_project.status != 0) {
                console.log(colors.white.bgRed('Erro: ')+clean_folder_project.stderr);
                process.exit(0);
            }
            var cp_project = commands.copy_project(tmp_folder, proj.directory);
            if (cp_project.status != 0) {
                console.log(colors.white.bgRed('Erro: ')+cp_project.stderr);
                process.exit(0);
            }
            var version_file = exec('cd '+ proj.directory +' && touch .version && echo '+tagselect.tag+' > .version');
            console.log(colors.green('\nProjeto '+colors.bold(proj.name)+' atualizado para '+tagselect.tag));
        })
    });
});
program.command('remote <name> <remote>').alias('r').description('Define remote para projeto').action(function(name, remote){
    var proj = _.find(store.get('projects'), (p) => {
        return p.name == name
    });

    if (proj == undefined) {
        console.log();
        console.log(colors.bgRed.white('ERRO') + colors.white(' Projeto não definido'));
        process.exit(0);
    }

    var projects = store.get('projects');

    _.each(projects, p => {
        if (p.name == name) {
            p.remote = remote
        }
    });

    store.put('projects', projects);

    console.log();
    console.log(colors.green('Remote para o projeto '+colors.white.bgGreen(name)+' definido'));

});
program.command('define <name> <remote>').alias('d').description('Define de projetos').action(function(name, remote){
    var project = store.get('projects');

    if(project == undefined){
        project = [];
    }

    var exist = _.find(project, (p) => {
        return p.name == name
    })

    if (exist != undefined) {
        console.log();
        console.log(colors.bgRed.white('ERRO') + colors.white(' Projeto já definido'));
        process.exit(0);
    }

    if(!emptyDir.sync(process.cwd())){
        console.log();
        console.log(colors.bgRed.white('ERRO') + colors.white(' Diretório não está vazio'));
        process.exit(0);
    }

    project.push({name: name, directory: process.cwd(), remote: remote});

    store.put('projects', project);

    console.log();
    console.log('Diretório definido para o projeto '+colors.bgGreen(name));
});
program.parse(process.argv);
