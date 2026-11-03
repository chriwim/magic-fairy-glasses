declare module "aframe" {
  interface ComponentDefinition {
    init?: (this: ComponentInstance) => void;
    tick?: (this: ComponentInstance) => void;
    remove?: (this: ComponentInstance) => void;
  }

  interface ComponentInstance {
    el: import("./scene").AEntity;
    [key: string]: unknown;
  }

  const AFRAME: {
    registerComponent(name: string, definition: ComponentDefinition): void;
  };
  export default AFRAME;
}
