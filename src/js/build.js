let fs = require("fs");
let cleanCss = require("clean-css");

require("esbuild").build({
  entryPoints: ["src/ts/map.ts"],
  bundle: true,
  outfile: "assets/js/map.js",
  target: "es2022",
  minify: true,
  keepNames: true,
  charset: "utf8",
  sourcemap: true,
});

fs.readFile("src/less/map.less", function (error, data) {
  if (error) {
    return console.error(error);
  }
  require("less")
    .render(data.toString(), {
      paths: ["src/less/"],
      rootpath: "../../src/less/",
      sourceMap: {
        sourceMapRootpath: "../../",
      },
    })
    .then(
      function (output) {
        new cleanCss({
          returnPromise: true,
          level: {
            1: {
              all: true,
              normalizeUrls: false,
            },
            2: {
              restructureRules: true,
            },
          },
          sourceMap: true,
        })
          .minify(output.css, output.map)
          .then(function (output) {
            fs.writeFile(
              "assets/css/map.css",
              output.styles.replace(
                /\.\.\/\.\.\/src\/less\/(?:images\/)?/g,
                "../../assets/images/"
              ),
              () => ""
            );
            fs.writeFile(
              "assets/css/map.css.map",
              output.sourceMap.toString(),
              () => ""
            );
          })
          .catch(function (error) {
            return console.error(error);
          });
      },
      function (error) {
        return console.error(error);
      }
    );
});
[
  "node_modules/leaflet/dist/images/",
  "node_modules/leaflet-fullscreen/dist/",
].forEach(function (dir) {
  fs.readdir(dir, function (error, files) {
    if (error) {
      return console.error(error);
    }

    files.forEach(function (file) {
      if (file.endsWith(".png")) {
        fs.copyFile(`${dir}${file}`, `assets/images/${file}`, () => "");
      }
    });
  });
});
