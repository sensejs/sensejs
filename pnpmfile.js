module.exports = {
    hooks: {
        readPackage (pkg) {
            switch (pkg.name) {
            case 'typeorm': // Work-around TypeORM peer dependencies issue
                pkg.peerDependencies['sqlite3'] = '^4.1.0';
                break
            }
            return pkg
        }
    }
};
