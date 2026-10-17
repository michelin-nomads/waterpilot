import { useId } from 'react';

import styles from './LaunchScene.module.scss';

const WAVES = 'M-160 0q40-16 80 0t80 0 80 0 80 0 80 0 80 0 80 0 80 0 80 0 80 0 80 0 80 0v180H-160Z';

/** A decorative little world: abstract geography, a community, and a continuous water cycle. */
export function LaunchScene() {
  const id = useId();
  const worldClip = `${id}-world`;
  const oceanClip = `${id}-ocean`;

  return (
    <svg className={styles.scene} viewBox="0 0 800 460" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={worldClip}>
          <circle cx="400" cy="276" r="148" />
        </clipPath>
        <clipPath id={oceanClip}>
          <path d="M252 290Q325 264 400 290t148 0v150H252Z" />
        </clipPath>
      </defs>
      <ellipse
        className={styles.orbit}
        cx="400"
        cy="276"
        rx="252"
        ry="104"
        transform="rotate(-18 400 276)"
      />
      <ellipse
        className={styles.orbitOuter}
        cx="400"
        cy="276"
        rx="286"
        ry="126"
        transform="rotate(-18 400 276)"
      />
      <ellipse className={styles.shadow} cx="400" cy="440" rx="113" ry="9" />
      <g className={styles.world}>
        <circle className={styles.sky} cx="400" cy="276" r="148" />
        <circle className={styles.sun} cx="329" cy="198" r="27" />
        <g clipPath={`url(#${worldClip})`}>
          <g className={styles.earthTurn}>
            <ellipse className={styles.meridian} cx="400" cy="276" rx="106" ry="148" />
            <ellipse className={styles.meridian} cx="400" cy="276" rx="53" ry="148" />
            <path
              className={styles.meridian}
              d="M252 276h296M267 214q133 45 266 0M267 338q133-45 266 0"
            />
          </g>
          <g className={styles.farHills}>
            <path className={styles.hillBack} d="M220 295q72-107 153-41t119-21 92 61v155H220Z" />
            <path className={styles.hillMid} d="M225 290q52-51 127-13t126-9 111 18v158H225Z" />
          </g>
          <path className={styles.land} d="M242 287q66-34 158 1t158-2v154H242Z" />
          <path
            className={styles.riverBank}
            d="M423 262q-49 17-16 31t-39 20l-44 27h93q48-26 33-39t-4-39Z"
          />
          <path
            className={styles.river}
            d="M426 263q-39 18-9 30t-25 24l-31 22h34q55-25 38-40t1-36Z"
          />
        </g>
        <g className={styles.community}>
          <g className={styles.farBuildings}>
            <path d="M339 238v-72h25v72M426 243v-85h25v85" />
            <path className={styles.farRoof} d="M342 166v-8h19v8M429 158v-9h19v9" />
          </g>
          <g className={styles.tower}>
            <rect x="366" y="127" width="44" height="133" rx="4" />
            <path className={styles.roof} d="M371 127v-9h34v9" />
            <path
              className={styles.windows}
              d="M377 143h5m12 0h5m-22 17h5m12 0h5m-22 17h5m12 0h5m-22 17h5m12 0h5m-22 17h5m12 0h5m-22 17h5m12 0h5"
            />
            <path className={styles.door} d="M383 260v-18h11v18" />
          </g>
          <g className={styles.house}>
            <path d="M281 263v-41l27-21 27 21v41Z" />
            <path className={styles.roof} d="m273 224 35-29 35 29" />
            <path className={styles.door} d="M300 263v-23h15v23" />
            <path className={styles.houseWindow} d="M288 229h8v9h-8Zm33 0h8v9h-8Z" />
          </g>
          <g className={styles.houseRight}>
            <path d="M457 272v-42l29-21 29 21v42Z" />
            <path className={styles.roof} d="m450 232 36-29 36 29" />
            <path className={styles.door} d="M478 272v-24h15v24" />
            <path className={styles.houseWindow} d="M464 236h8v9h-8Zm36 0h8v9h-8Z" />
            <path className={styles.solar} d="m474 211 16 0 9 8h-16Z" />
          </g>
          <g className={styles.trees}>
            <path className={styles.trunks} d="M264 274v-28m86 18v-29m91 40v-27m92 34v-28" />
            <circle cx="264" cy="241" r="14" />
            <circle cx="350" cy="230" r="12" />
            <circle cx="441" cy="244" r="12" />
            <circle cx="533" cy="249" r="16" />
          </g>
        </g>
        <g clipPath={`url(#${worldClip})`}>
          <g clipPath={`url(#${oceanClip})`}>
            <path className={styles.oceanBase} d="M248 282h304v150H248Z" />
            <g transform="translate(0 304)">
              <path className={`${styles.wave} ${styles.waveBack}`} d={WAVES} />
            </g>
            <g transform="translate(0 323)">
              <path className={`${styles.wave} ${styles.waveFront}`} d={WAVES} />
            </g>
            <g className={styles.ripples}>
              <path d="M289 344h34m24 21h39m53-16h40m-94 40h28m41-13h20m-140 4h14" />
            </g>
          </g>
        </g>
        <path className={styles.worldEdge} d="M252 276a148 148 0 0 0 296 0" />
      </g>
      <g className={styles.cloudLeft}>
        <path
          className={styles.cloud}
          d="M198 151a14 14 0 0 1 14-14h3a22 22 0 0 1 42 0h4a14 14 0 0 1 0 28h-49a14 14 0 0 1-14-14Z"
        />
      </g>
      <g className={styles.cloudRight}>
        <path
          className={styles.cloud}
          d="M521 123a10 10 0 0 1 10-10h3a17 17 0 0 1 32 0h3a10 10 0 0 1 0 20h-38a10 10 0 0 1-10-10Z"
        />
      </g>
      <g className={styles.dropFloat}>
        <circle className={styles.dropHalo} cx="582" cy="238" r="30" />
        <path className={styles.drop} d="M582 218s-12 14-12 23a12 12 0 0 0 24 0c0-9-12-23-12-23Z" />
        <path className={styles.dropShine} d="M576 240q0 7 6 7" />
      </g>
      <g className={styles.orbitDots}>
        <circle cx="187" cy="340" r="5" />
        <circle cx="613" cy="183" r="4" />
        <circle cx="240" cy="369" r="3" />
      </g>
    </svg>
  );
}
