window.BOUKEN_NOTE_REFERENCE_V2 = Object.freeze({
  version:'6.0-reference-v2-rebuild',
  canvas:Object.freeze({width:1672,height:941,orientation:'landscape'}),
  hudTop:516,
  preserved:Object.freeze(['protagonist placement direction','party character portraits','gameplay/state/combat logic']),
  rebuilt:Object.freeze(['mission panels','mission icons','party frames','ability icons','daily enemy visual','weekly enemy visual','enemy HP HUD','attack button','reward panel','coin HUD','ornamental frame system']),
  layout:Object.freeze({
    lore:{x:48,y:38,w:315,h:206},
    protagonist:{x:35,y:34,w:615,h:500},
    dailyEnemy:{x:665,y:176,w:330,h:290},
    dailyStatus:{x:690,y:398,w:306,h:82},
    weeklyEnemy:{x:1012,y:58,w:555,h:430},
    weeklyStatus:{x:1040,y:411,w:432,h:78},
    coin:{x:1422,y:30,w:196,h:60},
    missions:{x:18,y:516,w:610,h:405},
    party:{x:642,y:516,w:602,h:405},
    attack:{x:1332,y:484,w:276,h:276},
    reward:{x:1270,y:702,w:348,h:202}
  }),
  points:Object.freeze({daily:50,weekly:100,special:100}),
  enemies:Object.freeze({dailyMaxHp:800,weeklyMaxHp:4000}),
  assets:Object.freeze({
    dailyEnemy:'images/enemies/v6/daily_core.png',
    weeklyEnemy:'images/enemies/v6/weekly_celestia.png',
    attackRing:'images/ui/v6/attack-ring.svg',
    rewardCrystal:'images/ui/v6/reward-crystal.svg'
  })
});
