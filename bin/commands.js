const exec = require('sync-exec');

exports.download_project = function(remote, tag, destination){
    return exec('git clone --branch '+tag+' '+remote+' '+destination);
}

exports.clean_project = function(directory){
    return exec('rm -rf '+ directory +'/{,.[!.],..?}*');
}

exports.copy_project = function(directory, destination){
    return exec('cp -aR '+directory+'/. '+destination);
}
