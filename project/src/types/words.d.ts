declare module './words.json' {
  const words: string[];
  export default words;
}

declare module '*.json' {
  const value: string[];
  export default value;
}
