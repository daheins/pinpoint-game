import { Filter } from "pixi.js";

// Clean slate minimal filter that adheres strictly to Pixi v8 filter conventions.
// Geometry provides: aPosition, aUV; uniform: uProjectionMatrix; system binds uTexture.
// export function createMinimalFilter(): Filter {
//   const vertexShader = `
//     precision mediump float;
//     attribute vec2 aPosition;
//     attribute vec2 aUV;
//     uniform mat3 uProjectionMatrix;
//     varying vec2 vUV;
//     void main(void){
//       vUV = aUV;
//       vec3 pos = uProjectionMatrix * vec3(aPosition, 1.0);
//       gl_Position = vec4(pos.xy, 0.0, 1.0);
//     }
//   `;

//   const fragmentShader = `
//     precision mediump float;
//     varying vec2 vUV;
//     uniform sampler2D uTexture;
//     void main(void){
//       gl_FragColor = texture2D(uTexture, vUV);
//     }
//   `;

//   return Filter.from({ gl: { vertex: vertexShader, fragment: fragmentShader } });
// }
