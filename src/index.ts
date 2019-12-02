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

export const getUUID = (gun: Gun) => gun.opt()._.opt.uuid();

export const getId = (element: WithGunId) =>
  element && element["_"] && element["_"]["#"];

export const getPub = (id: string) => {
  let match;
  if ((match = /^~([^@].*)$/.exec(id))) {
    return match[1];
  } else if ((match = /^(.*)~(.*)\.$/.exec(id))) {
    return match[2];
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
    value = await Gun.SEA.encrypt(value, pair);
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

export const useGun = (Gun: GUN, useState: any, pair: Pair) => {
  const [data, setData] = useState({}) as [
    GunStore,
    (cb: (data: GunStore) => GunStore) => void
  ];

  // fetch data
  const onData = async (element: WithGunId & GunNode, key: string) => {
    const id = getId(element) || key;
    const decrypted = await decrypt(Gun, element, pair);
    setData((data: GunStore) => ({
      ...data,
      [id]: decrypted
    }));
  };

  return [data, onData];
};
