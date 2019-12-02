export type GUN = {
  SEA: SEA;
  state: () => number;
} & ((options: { localStorage: boolean; peers: string[] }) => Gun);

export type Gun = {
  get: (key: string) => Gun;
  put: (o: Primitive | Ref, cb?: () => void) => Gun;
  set: (o: Object) => Gun;
  then: () => Promise<Primitive>;
  opt: () => {
    _: {
      opt: {
        uuid: () => string;
      };
    };
  };
  on: (listener: (data: any, id: string) => void) => Gun;
  once: (listener: (data: any, id: string) => void) => Gun;
  map: (listener?: (data: any, id: string) => void) => Gun;
  user: () => {
    is: User;
    auth: (alias: string, pass: string, cb: () => void) => void;
    leave: () => void;
  };
};

export type User = {};

export type Primitive = string | number | boolean | null;

export type GunValue = Primitive | Ref;

export type Ref = {
  "#": string;
};

export type GunNode = {
  [key: string]: Primitive | Ref;
};

export type WithGunId = {
  _: {
    "#": string;
  };
};

export type GunStore = {
  [id: string]: GunNode;
};

export type SEA = {
  pair: () => Pair;
  sign: (message: SignedMessage, pair: AuthPair) => Promise<string>;
  encrypt: (value: Primitive, pair: Pair) => Promise<string>;
  decrypt: (value: Primitive, pair: Pair) => Promise<string>;
};

export type SignedMessage = {
  "#": string;
  ".": string;
  ":": Primitive | Ref;
  ">": number;
};

export type AuthPair = {
  priv: string;
  pub: string;
};

export type Pair = AuthPair & {
  epriv: string;
  epub: string;
};
