// =====================================================
// CHARACTER HUB DATA
// =====================================================

const CHARACTER_HUB_DATA = {

    cheng_xiaoshi: {
  
      id:
        'cheng_xiaoshi',
  
      name:
        'CHENG XIAOSHI',
  
      role:
        'TANK',
  
      image:
        '/assets/chengXiaoshi.jpg',
  
      pvp: {
  
        hp:
          850,
  
        basic: {
  
          key:
            'SPACE',
  
          name:
            'PUNCH',
  
          description:
            'Deals 80 damage in Cheng Xiaoshi’s front 180° area within 4 world units. Normally attacks once per second. During Strengthen it deals 100 damage and attacks twice per second.'
        },
  
        ability: {
  
          key:
            'Q',
  
          name:
            'CONTROL',
  
          description:
            'Throws a flying punch up to 12 world units for 50 damage. A successful hit stuns for 3 seconds and gives Cheng +50% movement speed for 3 seconds. Casting Control immediately resets Punch even if it misses. Cooldown: 10 seconds.'
        },
  
        ultimate: {
  
          key:
            'E',
  
          name:
            'STRENGTHEN',
  
          description:
            'For 5 seconds, Cheng gains +15% movement speed, Punch increases to 100 damage, and Punch can attack twice per second. Cooldown: 40 seconds.'
        }
      }
    },
  
  
    lu_guang: {
  
      id:
        'lu_guang',
  
      name:
        'LU GUANG',
  
      role:
        'ARCHER',
  
      image:
        '/assets/luGuang.jpg',
  
      pvp: {
  
        hp:
          600,
  
        basic: {
  
          key:
            'SPACE',
  
          name:
            'LASER',
  
          description:
            'Automatically fires at the closest living opponent within 15 world units. Deals 25 damage, fires four times per second, and travels at 80 world units per second. Normal Lasers do not home after being fired.'
        },
  
        ability: {
  
          key:
            'Q',
  
          name:
            'SHIELD',
  
          description:
            'Creates an 80 HP shield for 3 seconds. Damage is absorbed by the shield first, with excess damage carrying through to Lu Guang. Cooldown: 12 seconds.'
        },
  
        ultimate: {
  
          key:
            'E',
  
          name:
            'STRENGTHEN',
  
          description:
            'For 5 seconds, Lu Guang gains +20% movement speed. Lasers deal 30 damage and become homing attacks. Each strengthened Laser independently has a 33% chance to stun for 0.5 seconds. Cooldown: 35 seconds.'
        }
      }
    },
  
  
    qiao_ling: {
  
      id:
        'qiao_ling',
  
      name:
        'QIAO LING',
  
      role:
        'ASSASSIN',
  
      image:
        '/assets/qiaoLing.jpg',
  
      pvp: {
        hp:
            550,
        
        basic: {
        
            key:
            'SPACE',
        
            name:
            'BOXING',
        
            description:
            'One press performs two consecutive melee attacks within 4 units: a 30-damage fist followed shortly after by a 50-damage leg sweep. The sweep checks separately, so a fast or temporarily invulnerable opponent can avoid the second hit.'
        },
        
        ability: {
        
            key:
            'Q',
        
            name:
            'MOBILITY',
        
            description:
            'Qiao Ling bursts at 70 world units per second for 0.25 seconds. She can freely change direction using normal movement controls during the burst. Cooldown: 5 seconds.'
        },
        
        ultimate: {
        
            key:
            'E',
        
            name:
            'DAMAGE',
        
            description:
            'Qiao Ling rises 5.5 world units into the air for 1 second and can move normally while airborne. Non-tracking attacks cannot hit her. A filled red 5-unit-radius impact circle follows her position. She then crashes down for 350 AOE damage and a 1-second AOE stun. Cooldown: 25 seconds.'
        }
      }
    }
  };
  
  
  // =====================================================
  // STATE
  // =====================================================
  
  let characterHubMode =
    'pvp';
  
  
  let characterHubStats =
    {};
  
  
  // =====================================================
  // PROFICIENCY RANK
  // =====================================================
  
  function getProficiencyRank(
    score
  ) {
  
    const value =
      Math.max(
        0,
        Number(score) ||
        0
      );
  
  
    if (
      value <
      10
    ) {
  
      return {
        id:
          'bronze',
  
        name:
          'BRONZE'
      };
    }
  
  
    if (
      value <
      30
    ) {
  
      return {
        id:
          'silver',
  
        name:
          'SILVER'
      };
    }
  
  
    if (
      value <
      50
    ) {
  
      return {
        id:
          'gold',
  
        name:
          'GOLD'
      };
    }
  
  
    if (
      value <
      100
    ) {
  
      return {
        id:
          'platinum',
  
        name:
          'PLATINUM'
      };
    }
  
  
    if (
      value <
      200
    ) {
  
      return {
        id:
          'sapphire',
  
        name:
          'SAPPHIRE'
      };
    }
  
  
    return {
      id:
        'diamond',
  
      name:
        'DIAMOND'
    };
  }
  
  
  // =====================================================
  // OPEN CHARACTER HUB
  // =====================================================
  
  async function openCharacterHub() {
  
    characterHubMode =
      'pvp';
  
  
    await loadCharacterHubStats();
  
  
    showScreen(
      'character-hub-screen'
    );
  
  
    switchCharacterHubMode(
      'pvp'
    );
  }
  
  
  // =====================================================
  // LOAD STATS
  // =====================================================
  
  async function loadCharacterHubStats() {
  
    try {
  
      const response =
        await fetch(
  
          `/api/profile/${encodeURIComponent(
            playerName
          )}?viewer=${encodeURIComponent(
            playerName
          )}`
        );
  
  
      const data =
        await response.json();
  
  
      if (
        !response.ok
      ) {
  
        console.error(
          'Character stats request failed:',
          data
        );
  
  
        characterHubStats =
          {};
  
  
        return;
      }
  
  
      characterHubStats =
        data.characterStats ||
        {};
  
  
    } catch (error) {
  
      console.error(
        'Failed to load character stats:',
        error
      );
  
  
      characterHubStats =
        {};
    }
  }
  
  
  // =====================================================
  // MODE TAB
  // =====================================================
  
  function switchCharacterHubMode(
    mode
  ) {
  
    characterHubMode =
      mode;
  
  
    const pvpButton =
      document.getElementById(
        'character-tab-pvp'
      );
  
  
    const classicButton =
      document.getElementById(
        'character-tab-classic'
      );
  
  
    pvpButton
      .classList
      .toggle(
        'active',
        mode ===
          'pvp'
      );
  
  
    classicButton
      .classList
      .toggle(
        'active',
        mode ===
          'classic'
      );
  
  
    renderCharacterHub();
  }
  
  
  // =====================================================
  // RENDER HUB
  // =====================================================
  
  function renderCharacterHub() {
  
    const grid =
      document.getElementById(
        'character-hub-grid'
      );
  
  
    const notice =
      document.getElementById(
        'character-mode-notice'
      );
  
  
    if (
      characterHubMode ===
        'classic'
    ) {
  
      notice.innerText =
        'CLASSIC MATCH character information will be added later.';
  
  
      grid.innerHTML = `
  
        <div class="character-coming-soon">
  
          CLASSIC MATCH
  
          <span>
            CHARACTER KITS COMING SOON
          </span>
  
        </div>
  
      `;
  
  
      return;
    }
  
  
    notice.innerText =
      'PVP ARENA • wins award 2 proficiency points; other completed matches award 1.';
  
  
    grid.innerHTML =
      '';
  
  
    Object
      .values(
        CHARACTER_HUB_DATA
      )
      .forEach(
        character => {
  
          const stats =
            characterHubStats[
              character.id
            ] ||
            {};
  
  
          const proficiency =
            Number(
              stats.proficiencyPoints
            ) ||
            0;
  
  
          const actualMatches =
            Number(
              stats.pvpMatches
            ) ||
            0;
  
  
          const wins =
            Number(
              stats.pvpWins
            ) ||
            0;
  
  
          const rank =
            getProficiencyRank(
              proficiency
            );
  
  
          const card =
            document.createElement(
              'button'
            );
  
  
          card.type =
            'button';
  
  
          card.className =
            'character-hub-card';
  
  
          card.onclick =
            () => {
  
              openCharacterDetail(
                character.id
              );
            };
  
  
          card.innerHTML = `
  
            <div class="character-card-image-wrap">
  
              <img
                class="character-card-image"
                src="${character.image}"
                alt="${character.name}"
              >
  
              <div
                class="character-rank-slot"
                data-rank-character="${character.id}"
              ></div>
  
            </div>
  
  
            <div class="character-card-copy">
  
              <div class="character-card-role">
                ${character.role}
              </div>
  
  
              <h2>
                ${character.name}
              </h2>
  
  
              <div class="character-card-stats">
  
                <span>
                  ${rank.name}
                </span>
  
                <span>
                  ${proficiency} PROFICIENCY
                </span>
  
                <span>
                  ${actualMatches} PVP MATCHES
                </span>
  
                <span>
                  ${wins} WINS
                </span>
  
              </div>
  
            </div>
  
          `;
  
  
          grid.appendChild(
            card
          );
  
  
          const iconSlot =
            card.querySelector(
              `[data-rank-character="${character.id}"]`
            );
  
  
          iconSlot.appendChild(
  
            createProficiencyIcon(
              proficiency,
              54
            )
          );
        }
      );
  }
  
  
  // =====================================================
  // OPEN DETAIL
  // =====================================================
  
  function openCharacterDetail(
    characterId
  ) {
  
    if (
      characterHubMode !==
        'pvp'
    ) {
  
      return;
    }
  
  
    const character =
      CHARACTER_HUB_DATA[
        characterId
      ];
  
  
    if (!character) {
  
      return;
    }
  
  
    const stats =
      characterHubStats[
        characterId
      ] ||
      {};
  
  
    const score =
      Number(
        stats.proficiencyPoints
      ) ||
      0;
  
  
    const matches =
      Number(
        stats.pvpMatches
      ) ||
      0;
  
  
    const wins =
      Number(
        stats.pvpWins
      ) ||
      0;
  
  
    const rank =
      getProficiencyRank(
        score
      );
  
  
    const modal =
      document.getElementById(
        'character-detail-overlay'
      );
  
  
    const content =
      document.getElementById(
        'character-detail-content'
      );
  
  
    content.innerHTML = `
  
      <div class="character-detail-hero">
  
        <img
          src="${character.image}"
          alt="${character.name}"
        >
  
  
        <div class="character-detail-heading">
  
          <div class="character-detail-rank-row">
  
            <div id="character-detail-rank-icon"></div>
  
  
            <div>
  
              <span class="character-detail-rank-name">
                ${rank.name}
              </span>
  
              <span class="character-detail-rank-score">
                ${score} proficiency
              </span>
  
            </div>
  
          </div>
  
  
          <div class="character-card-role">
            ${character.role}
          </div>
  
  
          <h1>
            ${character.name}
          </h1>
  
  
          <div class="character-detail-summary">
  
            <span>
              ${character.pvp.hp} HP
            </span>
  
            <span>
              ${matches} PVP MATCHES
            </span>
  
            <span>
              ${wins} WINS
            </span>
  
          </div>
  
        </div>
  
      </div>
  
  
      <div class="character-detail-mode-label">
        PVP ARENA ABILITIES
      </div>
  
  
      ${abilityDetailMarkup(
        character.pvp.basic
      )}
  
  
      ${abilityDetailMarkup(
        character.pvp.ability
      )}
  
  
      ${abilityDetailMarkup(
        character.pvp.ultimate
      )}
  
    `;
  
  
    const iconHolder =
      document.getElementById(
        'character-detail-rank-icon'
      );
  
  
    iconHolder.appendChild(
  
      createProficiencyIcon(
        score,
        66
      )
    );
  
  
    modal.style.display =
      'flex';
  }
  
  
  // =====================================================
  // ABILITY MARKUP
  // =====================================================
  
  function abilityDetailMarkup(
    ability
  ) {
  
    return `
  
      <div class="character-ability-detail">
  
        <div class="character-ability-key">
          ${ability.key}
        </div>
  
  
        <div>
  
          <h3>
            ${ability.name}
          </h3>
  
  
          <p>
            ${ability.description}
          </p>
  
        </div>
  
      </div>
  
    `;
  }
  
  
  // =====================================================
  // CLOSE DETAIL
  // =====================================================
  
  function closeCharacterDetail() {
  
    document
      .getElementById(
        'character-detail-overlay'
      )
      .style.display =
        'none';
  }
  
  
  // =====================================================
  // PIXEL BADGE
  // =====================================================
  
  function createProficiencyIcon(
    score,
    size = 48
  ) {
  
    const rank =
      getProficiencyRank(
        score
      );
  
  
    const canvas =
      document.createElement(
        'canvas'
      );
  
  
    canvas.width =
      24;
  
  
    canvas.height =
      24;
  
  
    canvas.style.width =
      `${size}px`;
  
  
    canvas.style.height =
      `${size}px`;
  
  
    canvas.style.imageRendering =
      'pixelated';
  
  
    canvas.className =
      'proficiency-pixel-icon';
  
  
    canvas.title =
      `${rank.name} • ${score} proficiency`;
  
  
    const ctx =
      canvas.getContext(
        '2d'
      );
  
  
    ctx.imageSmoothingEnabled =
      false;
  
  
    drawRankBadge(
      ctx,
      rank.id
    );
  
  
    return canvas;
  }
  
  
  // =====================================================
  // PIXEL HELPER
  // =====================================================
  
  function px(
    ctx,
    x,
    y,
    width,
    height,
    color
  ) {
  
    ctx.fillStyle =
      color;
  
  
    ctx.fillRect(
      x,
      y,
      width,
      height
    );
  }
  
  
  // =====================================================
  // BASE SHIELD
  // =====================================================
  
  function drawShield(
    ctx,
    outer,
    inner,
    shine
  ) {
  
    px(ctx, 6, 5, 12, 2, outer);
    px(ctx, 5, 7, 14, 5, outer);
    px(ctx, 6, 12, 12, 3, outer);
    px(ctx, 7, 15, 10, 2, outer);
    px(ctx, 8, 17, 8, 2, outer);
    px(ctx, 9, 19, 6, 1, outer);
    px(ctx, 10, 20, 4, 1, outer);
    px(ctx, 11, 21, 2, 1, outer);
  
    px(ctx, 7, 7, 10, 5, inner);
    px(ctx, 8, 12, 8, 3, inner);
    px(ctx, 9, 15, 6, 2, inner);
    px(ctx, 10, 17, 4, 2, inner);
  
    px(ctx, 8, 8, 2, 5, shine);
    px(ctx, 10, 7, 4, 1, shine);
  }
  
  
  // =====================================================
  // DRAW RANK
  // =====================================================
  
  function drawRankBadge(
    ctx,
    rank
  ) {
  
    ctx.clearRect(
      0,
      0,
      24,
      24
    );
  
  
    if (
      rank ===
        'bronze'
    ) {
  
      drawShield(
        ctx,
        '#573018',
        '#a9602f',
        '#e8a263'
      );
  
  
      px(
        ctx,
        11,
        11,
        2,
        6,
        '#ffd098'
      );
  
  
      return;
    }
  
  
    if (
      rank ===
        'silver'
    ) {
  
      px(ctx, 3, 9, 2, 6, '#68717d');
      px(ctx, 19, 9, 2, 6, '#68717d');
      px(ctx, 2, 10, 1, 4, '#d7dde3');
      px(ctx, 21, 10, 1, 4, '#d7dde3');
  
  
      drawShield(
        ctx,
        '#59626e',
        '#adb5bf',
        '#ffffff'
      );
  
  
      px(
        ctx,
        11,
        10,
        2,
        7,
        '#ffffff'
      );
  
  
      return;
    }
  
  
    if (
      rank ===
        'gold'
    ) {
  
      px(ctx, 7, 3, 2, 3, '#a86c0b');
      px(ctx, 11, 2, 2, 4, '#ffe267');
      px(ctx, 15, 3, 2, 3, '#a86c0b');
      px(ctx, 8, 5, 8, 2, '#df9e15');
  
  
      drawShield(
        ctx,
        '#8f5b08',
        '#e4a31a',
        '#ffe676'
      );
  
  
      px(ctx, 11, 10, 2, 7, '#fff3a8');
      px(ctx, 9, 12, 6, 2, '#fff3a8');
  
  
      return;
    }
  
  
    if (
      rank ===
        'platinum'
    ) {
  
      px(ctx, 2, 8, 3, 2, '#6d818b');
      px(ctx, 1, 10, 4, 2, '#bad2d9');
      px(ctx, 2, 12, 3, 2, '#6d818b');
  
      px(ctx, 19, 8, 3, 2, '#6d818b');
      px(ctx, 19, 10, 4, 2, '#bad2d9');
      px(ctx, 19, 12, 3, 2, '#6d818b');
  
  
      drawShield(
        ctx,
        '#4c6269',
        '#9fc4cc',
        '#ecfdff'
      );
  
  
      px(ctx, 11, 9, 2, 2, '#ffffff');
      px(ctx, 10, 11, 4, 4, '#dafaff');
      px(ctx, 11, 15, 2, 2, '#ffffff');
  
  
      return;
    }
  
  
    if (
      rank ===
        'sapphire'
    ) {
  
      px(ctx, 1, 7, 4, 2, '#174988');
      px(ctx, 2, 5, 4, 2, '#2879ce');
      px(ctx, 3, 3, 4, 2, '#69baff');
      px(ctx, 1, 9, 5, 2, '#1d61ae');
  
      px(ctx, 19, 7, 4, 2, '#174988');
      px(ctx, 18, 5, 4, 2, '#2879ce');
      px(ctx, 17, 3, 4, 2, '#69baff');
      px(ctx, 18, 9, 5, 2, '#1d61ae');
  
  
      drawShield(
        ctx,
        '#0c356d',
        '#176dc2',
        '#66c6ff'
      );
  
  
      px(ctx, 10, 9, 4, 2, '#b8edff');
      px(ctx, 9, 11, 6, 4, '#238fff');
      px(ctx, 10, 15, 4, 2, '#074ba5');
      px(ctx, 11, 10, 2, 2, '#ffffff');
  
  
      return;
    }
  
  
    // DIAMOND
  
    px(ctx, 0, 7, 5, 2, '#5dd8ff');
    px(ctx, 1, 5, 5, 2, '#a4efff');
    px(ctx, 2, 3, 5, 2, '#e6fcff');
    px(ctx, 0, 9, 6, 2, '#35b9e8');
  
    px(ctx, 19, 7, 5, 2, '#5dd8ff');
    px(ctx, 18, 5, 5, 2, '#a4efff');
    px(ctx, 17, 3, 5, 2, '#e6fcff');
    px(ctx, 18, 9, 6, 2, '#35b9e8');
  
    px(ctx, 7, 2, 2, 3, '#9ceeff');
    px(ctx, 11, 0, 2, 5, '#ffffff');
    px(ctx, 15, 2, 2, 3, '#9ceeff');
    px(ctx, 7, 4, 10, 2, '#50cff8');
  
  
    drawShield(
      ctx,
      '#25769a',
      '#72dcff',
      '#f0feff'
    );
  
  
    px(ctx, 10, 8, 4, 2, '#ffffff');
    px(ctx, 8, 10, 8, 4, '#baf5ff');
    px(ctx, 9, 14, 6, 3, '#59d6ff');
    px(ctx, 10, 17, 4, 2, '#2397c3');
    px(ctx, 11, 19, 2, 1, '#186f91');
  
    px(ctx, 3, 1, 1, 3, '#ffffff');
    px(ctx, 2, 2, 3, 1, '#ffffff');
    px(ctx, 20, 14, 1, 3, '#ffffff');
    px(ctx, 19, 15, 3, 1, '#ffffff');
  }