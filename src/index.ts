import {
  Gun,
  GunNode,
  WithGunId,
  Pair,
  Primitive,
  Ref,
  GunValue,
  GUN,
  GunStore
} from "./models";
import MD from "markdown-it";
import { stringify } from "qs";

const WikiLinks = require("markdown-it-wikilinks");
const IFrame = require("markdown-it-iframe");

export const getUUID = (gun: Gun) => gun.opt()._.opt.uuid();

export const getId = (element: WithGunId) =>
  element && element["_"] && element["_"]["#"];

export const getPub = (id: string) => {
  let match;
  if ((match = /~([^@][^\.]+\.[^\.]+)/.exec(id))) {
    return match[1];
  }
};

export const getSubUUID = (gun: Gun, pub: string) =>
  pub ? `${getUUID(gun)}~${pub}.` : getUUID(gun);

const seaMemo: { [key: string]: Primitive } = {};

export const decrypt = async (Gun: GUN, node: GunNode, pair: Pair) => {
  node = { ...node };
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (typeof value === "string" && value.startsWith("SEA{")) {
      if (value in seaMemo) {
        node[key] = seaMemo[value];
      } else {
        try {
          const actualValue = await Gun.SEA.decrypt(value, pair);
          node[key] = actualValue;
          seaMemo[value] = actualValue;
        } catch (e) {
          delete node[key];
        }
      }
    }
  }
  return node;
};

/*
export const verify = async (node, seaMemo) => {
  node = { ...node };
  const pub = getPub(getId(node));
  if (pub) {
    for (const key of Object.keys(node).filter(
      key => !["_", "pub"].includes(key)
    )) {
      const value = node[key];
      let verified;
      const stringified = JSON.stringify(value);
      if (stringified in seaMemo) {
        verified = seaMemo[stringified];
      } else {
        try {
          // gun provides auth values as stringified object ¯\_(ツ)_/¯
          verified = JSON.parse(value);
        } catch (e) {
          verified = await SEA.verify(value, pub);
          console.log(value, pub, verified);
        }
        verified = verified[":"];
        seaMemo[stringified] = verified;
      }
      node[key] = verified;
    }
  }
  return node;
};
*/

export const getSet = (data: GunStore, id: string) => {
  const set = data[id];
  if (!set) {
    return [];
  }
  const arr = Object.keys(set)
    .filter(key => key !== "_")
    .map(key => set[key])
    .filter(isRef)
    .map((ref: Ref) => data[ref["#"]])
    .filter(Boolean);
  return arr;
};

const isRef = (value: Primitive | Ref): value is Ref =>
  !!value && typeof value === "object";

export const put = async (
  Gun: GUN,
  gun: Gun,
  id: string,
  key: string,
  value: GunValue,
  pair: Pair
) => {
  if (pair && pair.epriv && value && typeof value !== "object") {
    const encryptedValue = await Gun.SEA.encrypt(value, pair);
    seaMemo[encryptedValue] = value;
    value = encryptedValue;
  }

  if (pair && pair.priv) {
    value = await Gun.SEA.sign(
      {
        "#": id,
        ".": key,
        ":": value,
        ">": Gun.state()
      },
      pair
    );
  }

  gun
    .get(id)
    .get(key)
    .put(value);
};

export const useGun = (Gun: GUN, gun: Gun, useState: any, pair: Pair) => {
  const [data, setData] = useState({}) as [
    GunStore,
    (cb: (data: GunStore) => GunStore) => void
  ];
  const [debouncer] = useState(new Debouncer(setData));

  // fetch data
  const onData = async (element: WithGunId & GunNode, key: string) => {
    const id = getId(element) || key;
    const decrypted = await decrypt(Gun, element, pair);
    debouncer.setData((data: GunStore) => ({
      ...data,
      [id]: { ...data[id], ...decrypted }
    }));
  };

  const puts = (...values: [string, string, Primitive | Ref][]) => {
    setData((data: GunStore) =>
      values.reduce(
        (data, [id, key, value]) => ({
          ...data,
          [id]: { _: { "#": id }, ...data[id], [key]: value }
        }),
        data
      )
    );
    for (const [id, key, value] of values) {
      put(Gun, gun, id, key, value, pair);
    }
  };

  return [data, onData, puts];
};

class Debouncer {
  private handler: any;
  private updates: any[] = [];
  constructor(private cb: any) {}
  setData(update: any) {
    this.updates.push(update);
    if (!this.handler) {
      this.handler = setTimeout(() => {
        const updates = this.updates;
        this.cb((data: any) =>
          updates.reduce((data, update) => update(data), data)
        );
        this.updates = [];
        this.handler = null;
      }, 15);
    }
  }
}

export const getMd = ({
  pub,
  base,
  hash
}: {
  pub?: string;
  base?: string;
  hash?: string;
}) => {
  return MD()
    .use(IFrame, {
      height: 300
    })
    .use(
      WikiLinks({
        baseURL: `${base || ""}?id=`,
        uriSuffix: hash,
        makeAllLinksAbsolute: true,
        postProcessPageName: (pageName: string) => {
          pageName = pageName.trim();
          if (pageName === "/") {
            pageName = "";
          } else {
            pageName = `.${pageName}`;
          }
          return encodeURIComponent((pub ? `~${pub}` : "") + pageName);
        }
      })
    );
};

export const qs = (o: { [key: string]: Primitive }, p: string) => {
  const object: { [key: string]: Primitive } = {};
  for (const key of Object.keys(o)) {
    if (o[key]) {
      object[key] = o[key];
    }
  }
  const stringified = stringify(object);
  return stringified ? `${p}${stringified}` : "";
};
