import L from "leaflet";
import "leaflet-fullscreen";

type AreaId = "paldea" | "kitakami" | "blueberry";
type AreaData = {
  [x in AreaId]: number;
};

type IconName = {
  [x: string]: string;
};

type RoadName = {
  [x: string]: {
    "": string;
    [x: string]: string;
  };
};

type BoundaryData = {
  [x: string]: {
    name: string;
    points: [[number, number]];
  };
};

type StakeData = {
  [x: string]: {
    [x: string]: [
      {
        id: number;
        x: number;
        y: number;
      }
    ];
  };
};

type Pokemon = {
  name: string;
  x: number;
  y: number;
};

type PokemonData = {
  [x: string]: [Pokemon];
};

type Layers = {
  [x: string]: L.FeatureGroup;
};

declare global {
  interface String {
    hashCode(): number;
  }

  interface Window {
    map: L.Map;
    layers: Layers;
    pokemon_layers: Layers;
  }
}

const IMAGE_WIDTHS: AreaData = {
  paldea: 13000,
  kitakami: 6800,
  blueberry: 6800,
};
const IMAGE_HEIGHTS: AreaData = {
  paldea: 13000,
  kitakami: 6800,
  blueberry: 6800,
};
const GAME_WIDTHS: AreaData = {
  paldea: 5000,
  kitakami: 2000,
  blueberry: 2000,
};
const GAME_HEIGHTS: AreaData = {
  paldea: 5000,
  kitakami: 2000,
  blueberry: 2000,
};

const MAX_ZOOM = 3;
const TILE_SIZE = 250;
const ICON_NAME: IconName = {
  wochien: "古简蜗-0",
  chienpao: "古剑豹-0",
  tinglu: "古鼎鹿-0",
  chiyu: "古玉鱼-0",
  chest: "索财灵-0",
};
const ROAD_NAME: RoadName = {
  gym: {
    "": "冠军之路",
    bug: "阿枫",
    electric: "奇树",
    ghost: "莱姆",
    grass: "寇沙",
    hof: "八朔",
    ice: "古鲁夏",
    normal: "青木",
    psychic: "莉普",
    water: "海岱",
  },
  titan: {
    "": "传说之路",
    dragon: "伪龙宝主",
    flying: "长空宝主",
    ground: "土震宝主",
    rock: "岩壁宝主",
    steel: "潜钢宝主",
  },
  star: {
    "": "星尘★之路",
    dark: "皮拿",
    fairy: "奥尔迪加",
    fighting: "枇琶",
    fire: "梅洛可",
    poison: "秋明",
    star: "仙后",
  },
};

String.prototype.hashCode = function () {
  let seed = 20221118;
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch: number; i < this.length; i++) {
    ch = this.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

let ZOOMED_WIDTH = 0,
  ZOOMED_HEIGHT = 0;
let GAME_WIDTH = 0,
  GAME_HEIGHT = 0;
function convert_coord(x: number, y: number): [number, number] {
  let crs_x = x * (ZOOMED_WIDTH / GAME_WIDTH);
  let crs_y = y * (ZOOMED_HEIGHT / GAME_HEIGHT);
  return [-crs_y, crs_x];
}

let script_root = document.currentScript
  ?.getAttribute("src")
  ?.replace(/\/[^\/]+\/[^\/]+$/, "");

$(function () {
  function load_data(
    name: string,
    layers: Layers,
    map: L.Map | Object,
    callback: Function,
    data_name: string | undefined = undefined
  ) {
    let data =
      JSON.parse(
        localStorage.getItem(`sv-${data_name || name}-data`) || "{}"
      ) || {};
    let time = parseInt(
      localStorage.getItem(`sv-${data_name || name}-data-time`) || "0"
    );
    if (isNaN(time) || +new Date() - time > 86400 * 1000) {
      data = {};
    }
    layers[name] = L.featureGroup();

    if (!$.isEmptyObject(data)) {
      try {
        callback(data, layers, map);
      } catch (e) {
        console.error(e);
        data = {};
      }
    }
    if ($.isEmptyObject(data)) {
      $.get(`${script_root}/json/${data_name || name}_data.json`).done(
        function (data) {
          localStorage.setItem(
            `sv-${data_name || name}-data`,
            JSON.stringify(data)
          );
          localStorage.setItem(
            `sv-${data_name || name}-data-time`,
            "" + +new Date()
          );
          callback(data, layers, map);
        }
      );
    }
  }

  function show_boundary(
    boundary_data: BoundaryData,
    layers: Layers,
    map: L.Map,
    filter_page: string = "",
    layer_name: string = "boundary"
  ) {
    let x_1 = GAME_WIDTH,
      y_1 = GAME_HEIGHT,
      x_2 = 0,
      y_2 = 0;
    for (let key in boundary_data) {
      let name = boundary_data[key].name;
      if (filter_page !== "" && name !== filter_page) {
        continue;
      }
      let points = boundary_data[key].points;
      x_1 = Math.min(x_1, ...points.map((x: any[]) => x[0]));
      x_2 = Math.max(x_2, ...points.map((x: any[]) => x[0]));
      y_1 = Math.min(y_1, ...points.map((x: any[]) => x[1]));
      y_2 = Math.max(y_2, ...points.map((x: any[]) => x[1]));
      let color = key.hashCode().toString(16).padStart(6, "0").slice(-6);
      let polygon = L.polygon(
        points.map((x: number[]) => convert_coord(x[0], x[1])),
        {
          color: `#${color}`,
        }
      ).addTo(layers[layer_name || "boundary"]);
      polygon.bindPopup(
        `<a href="/wiki/区域:${name}#sv-area-${key}">${name}</a> (${key})`
      );
    }
    if (filter_page !== "") {
      map.fitBounds(
        L.latLngBounds(
          L.latLng(...convert_coord(x_1, y_1)),
          L.latLng(...convert_coord(x_2, y_2))
        )
      );
    }
  }

  function show_stake(stake_data: StakeData, layers: Layers) {
    ["wochien", "chienpao", "tinglu", "chiyu"].forEach(function (value) {
      let form: string = ICON_NAME[value];
      let icon = L.divIcon({
        className: `p p-${form}`,
        iconSize: [64, 64],
      });
      stake_data[value][value].forEach(function (coord: {
        x: number;
        y: number;
      }) {
        let crs_coord = convert_coord(coord.x, coord.y);
        let marker = L.marker(crs_coord, {
          icon: icon,
        }).addTo(layers["stake"]);
        marker.bindPopup(
          `<a href="/wiki/形态:${form}">${form.split("-")[0]}的桩子</a>`
        );
      });
    });
    ["gym", "titan", "star"].forEach(function (value) {
      let road = ROAD_NAME[value];
      for (let type in stake_data[value]) {
        let chara = road[type];
        let icon = L.divIcon({
          className: `icon-trainer icon-${chara}`,
          iconSize: [24, 24],
        });
        stake_data[value][type].forEach(function (coord: {
          x: number;
          y: number;
        }) {
          let crs_coord = convert_coord(coord.x, coord.y);
          let marker = L.marker(crs_coord, {
            icon: icon,
          }).addTo(layers["roads"]);
          marker.bindPopup(
            `<a href="/wiki/${road[""]}#${
              chara == "八朔" ? "四天王" : chara
            }">${chara == "八朔" ? "四天王、冠军" : chara}</a>`
          );
        });
      }
    });
  }

  function show_legendary(legendary_data: PokemonData, layers: Layers) {
    legendary_data["legendary"].forEach((pokemon) => {
      let name = pokemon.name;
      let icon = L.divIcon({
        className: `p p-${name}`,
        iconSize: [64, 64],
      });
      let crs_coord = convert_coord(pokemon.x, pokemon.y);
      let marker = L.marker(crs_coord, {
        icon: icon,
      }).addTo(layers["legendary"]);
      marker.bindPopup(
        `<a href="/wiki/形态:${name}">${name.split("-")[0]}</a>`
      );
    });
  }

  function show_ogre(ogre_data: PokemonData, layers: Layers) {
    ogre_data["ogre"].forEach((pokemon) => {
      let name = pokemon.name;
      let icon = L.divIcon({
        className: `icon-trainer icon-鬼面组`,
        iconSize: [24, 24],
      });
      let crs_coord = convert_coord(pokemon.x, pokemon.y);
      let marker = L.marker(crs_coord, {
        icon: icon,
      }).addTo(layers["ogre"]);
      marker.bindPopup(`<a href="/wiki/北上鬼面组">${name}</a>`);
    });
  }

  function show_current_area(
    boundary_data: BoundaryData,
    layers: Layers,
    map: L.Map,
    content: JQuery<HTMLElement>
  ) {
    let page_title = mw.config.get("wgTitle");
    show_boundary(boundary_data, layers, map, page_title, "area");

    let pokemon_layers: Layers = {};
    content
      .find("tr[data-points]")
      .each(function () {
        let tr = $(this);
        let points = tr.data("points")
          ? `${tr.data("points")}`
              .split("/")
              .map((x) => x.split(",").map((y) => +y))
              .map((y) => convert_coord(y[0], y[1]))
          : [];
        let form = tr.data("form");
        let level = tr.data("level");
        let note = tr.find("td:last-child").text().trim();
        let icon = L.divIcon({
          className: `p p-${form}`,
          iconSize: [64, 64],
        });
        if (!pokemon_layers[form]) {
          pokemon_layers[form] = L.featureGroup().addTo(layers["pokemon"]);
        }
        let layer = pokemon_layers[form];
        points.forEach(function (point) {
          let marker = L.marker(point, {
            icon: icon,
          }).addTo(layer);
          marker.bindPopup(
            `<a href="#sv-fixed-${form}">${form.split("-")[0]}</a>${
              level == "0" || level == "-" ? "" : ` Lv. ${level}`
            }${note ? `<br>（${note}）` : ""}`
          );
        });
        tr.find("i.p").wrap(`<a href="#sv-map"></a>`);
      })
      .on("click", function () {
        let form = $(this).data("form");
        (layers["pokemon"] as L.FeatureGroup).clearLayers();
        if ($(this).hasClass("sv-fixed-selected")) {
          content.find(".sv-fixed-selected").removeClass("sv-fixed-selected");
          for (let form in pokemon_layers) {
            pokemon_layers[form].addTo(layers["pokemon"]);
          }
        } else {
          content.find(".sv-fixed-selected").removeClass("sv-fixed-selected");
          pokemon_layers[form].addTo(layers["pokemon"]);
          map.fitBounds(pokemon_layers[form].getBounds());
          content.find(`tr[data-form="${form}"]`).addClass("sv-fixed-selected");
        }
      });
    window.pokemon_layers = pokemon_layers;
  }

  mw.hook("wikipage.content").add(function (content: JQuery<HTMLElement>) {
    let map_id = ($(".sv-map").data("map") || "paldea") as AreaId;
    const postfix =
      map_id == "paldea" ? "" : map_id == "kitakami" ? "_k" : "_b";
    const IMAGE_WIDTH = IMAGE_WIDTHS[map_id],
      IMAGE_HEIGHT = IMAGE_HEIGHTS[map_id];
    (ZOOMED_WIDTH = IMAGE_WIDTH / 16), (ZOOMED_HEIGHT = IMAGE_HEIGHT / 16);
    (GAME_WIDTH = GAME_WIDTHS[map_id]), (GAME_HEIGHT = GAME_HEIGHTS[map_id]);

    let map = L.map("sv-map", {
      minZoom: 0,
      maxZoom: MAX_ZOOM,
      crs: L.CRS.Simple,
      maxBounds: new L.LatLngBounds(
        L.latLng(0, 0),
        L.latLng(-ZOOMED_HEIGHT, ZOOMED_WIDTH)
      ),
      maxBoundsViscosity: 0.5,
      fullscreenControl: true,
    }).setView(L.latLng(0, 0), +(map_id != "paldea"));
    let layers: Layers = {};

    L.tileLayer("{path}", {
      path: function (data: { x: number; y: number; z: number }) {
        if (
          Math.min(data.x, data.y) < 0 ||
          Math.max(data.x, data.y) * (4 / (1 << data.z)) >=
            Math.ceil(IMAGE_WIDTH / TILE_SIZE / 4)
        ) {
          return "data:image/gif;base64,R0lGODlhAQABAJEAAP///wAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
        } else {
          return `${script_root}/tiles${postfix}/${data.z}/${data.x},${data.y}.webp`;
        }
      },
      attribution: "朱·紫数据库 | sv.xzonn.top",
      tileSize: TILE_SIZE,
    } as L.TileLayerOptions).addTo(map);

    load_data("boundary", layers, map, show_boundary, `boundary${postfix}`);
    if (map_id == "paldea") {
      layers["gimmighoul"] = L.featureGroup();
      layers["roads"] = L.featureGroup();
      load_data("stake", layers, map, show_stake);
      layers["legendary"] = L.featureGroup();
      load_data("legendary", layers, map, show_legendary);
    } else if (map_id == "kitakami") {
      layers["ogre"] = L.featureGroup();
      load_data("legendary_k", layers, map, show_ogre);
    } else if (map_id == "blueberry") {
      layers["legendary"] = L.featureGroup();
      load_data("legendary_b", layers, map, show_legendary);
    }
    if (
      mw.config.get("wgCategories").includes("区域") ||
      content.find("tr[data-points]").length
    ) {
      mw.config.get("wgCategories").includes("区域") &&
        (layers["area"] = L.featureGroup());
      layers["pokemon"] = L.featureGroup();

      content
        .find(".sv-map-layer ul")
        .append([
          (mw.config.get("wgCategories").includes("区域")
            ? $(`<li><a href="#sv-map-area-off">✔️当前区域</a></li>`)
            : "") as JQuery<Element>,
          $(`<li><a href="#sv-map-pokemon-off">✔️宝可梦</a></li>`),
        ]);
      load_data(
        "boundary",
        {},
        {},
        (boundary_data: BoundaryData) => {
          show_current_area(boundary_data, layers, map, content);
        },
        `boundary${postfix}`
      );
    }

    function hash_handle(hash: string, reverse: boolean = false) {
      let hash_splited = hash.split("-");
      if (hash_splited[0] !== "#sv" || hash_splited[1] !== "map") {
        return;
      }
      let layer = layers[hash_splited[2]];
      if (!layer) {
        return;
      }
      let action_is_on = reverse
        ? hash_splited[3] == "off"
        : hash_splited[3] == "on";
      let link = content.find(`.sv-map-layer a[href*="${hash_splited[2]}"]`);
      if (link) {
        if (action_is_on) {
          layer.addTo(map);
          if (!reverse) {
            link.attr(
              "href",
              (link.attr("href") as string).replace(/-(on|off)$/, "-off")
            );
            link.text(link.text().replace(/^[✔️❌]/, "✔️"));
          }
        } else {
          layer.removeFrom(map);
          if (!reverse) {
            link.attr(
              "href",
              (link.attr("href") as string).replace(/-(on|off)$/, "-on")
            );
            link.text(link.text().replace(/^[✔️❌]/, "❌"));
          }
        }
      }
    }
    function hash_handle_element(
      element: HTMLElement,
      reverse: boolean = false
    ) {
      let hash = "#" + ($(element).attr("href") || "").split("#")[1];
      hash_handle(hash, reverse);
    }
    function hash_handle_event(event: JQuery.Event | null) {
      let hash = "#" + location.hash.split("#")[1];
      hash_handle(hash, false);
      if (event) {
        event.preventDefault();
      }
    }
    content.find(".sv-map-layer a").each(function () {
      hash_handle_element(this, true);
    });
    content.find(".sv-map-layer").on("click", function (event) {
      if ($(event.target).is("a")) {
        hash_handle_element(event.target);
        event.preventDefault();
      }
    });
    $(window).on("hashchange", hash_handle_event);
    hash_handle_event(null);
    content.find(".sv-map-pending").removeClass("sv-map-pending");

    window.layers = layers;
    window.map = map;
  });
});
