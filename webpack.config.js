const path = require('path');

module.exports = {
    entry: './public/app.ts', // Entry point for your TypeScript file
    output: {
        filename: 'app.bundle.js', // Output bundled file
        path: path.resolve(__dirname, 'public'), // Output directory
    },
    resolve: {
        extensions: ['.ts', '.js'], // Resolve these extensions
    },
    module: {
        rules: [
            {
                test: /\.ts$/, // Process TypeScript files
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    mode: 'development', // Set mode to 'development' or 'production'
};
