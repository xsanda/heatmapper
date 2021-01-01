// Source: https://stackoverflow.com/a/53229567/2275559

/* eslint-disable @typescript-eslint/ban-types */

type Values<T extends object> = T[keyof T];

type Tuplize<T extends object[]> = Pick<
  T,
  Exclude<keyof T, Extract<keyof object[], string> | number>
>;

type OneOf<T extends object> = Values<
  {
    [K in keyof T]: T[K] &
      {
        [M in Values<{ [L in keyof Omit<T, K>]: keyof T[L] }>]?: undefined;
      };
  }
>;

type XOR<T extends object[]> = OneOf<Tuplize<T>>;

export default XOR;
