// Movement is in pitch metres and passing preferences adjust decision utility.
// These are Ballerz tuning values. Empty profiles preserve the base slot's behaviour.
const profiles = {};
function role(id, label, description, effects = {}) {
  profiles[id] = effects;
  return [id, {label, description}];
}
const advancedWingback = role('advanced-wing-back', 'Advanced wing-back', 'Push beyond midfield and stay wide to offer a high outlet for a cross.', {advance: 17, flank: 5, run: 4, cross: 0.18});
const boxPlaymaker = role('box-to-box-playmaker', 'Box-to-box playmaker', 'Show for the ball at the base of midfield, then join the attack to play a runner through.', {depth: -3, advance: 15, attract: 0.11, through: 0.17, run: 3});
const insideFullback = role('inside-full-back', 'Inside full-back', 'Tuck in beside the centre-backs and provide cover behind the ball.', {depth: -4, narrow: 0.65, shortPass: 0.10});
const midfieldMaker = role('midfield-playmaker', 'Midfield playmaker', 'Show for passes in central midfield and look to split the next defensive line.', {roam: 0.21, attract: 0.13, through: 0.20});
const noNonsenseCB = role('no-nonsense-centre-back', 'No-nonsense centre-back', 'Hold the back line, avoid risky passing lanes and clear upfield under pressure.', {depth: -2, safeExit: 0.33});
const wideCentralMid = role('wide-central-midfielder', 'Wide central midfielder', 'Pull out of central midfield into a wide supporting lane for the player on the flank.', {flank: 11, shortPass: 0.10, cross: 0.08});
const wideCB = role('wide-centre-back', 'Wide centre-back', 'Spread to the outside of a back three while staying behind the midfield.', {flank: 8, depth: -2, shortPass: 0.07});
const wideForward = role('wide-forward', 'Wide forward', 'Start wide to stretch the defence, then attack the area to finish when the ball arrives from the opposite flank.', {advance: 8, flank: 4, run: 6, finish: 0.10, attackFarPost: 0.65});

const keeper = role('goalkeeper', 'Goalkeeper', 'Offer a safe outlet behind the centre-backs.');
const distributor = role('ball-playing-keeper', 'Ball-playing goalkeeper', 'Step up to support the build-up and look for a nearby passing option.', {depth: 3, shortPass: 0.24});
const clearingKeeper = role('direct-keeper', 'No-nonsense goalkeeper', 'Send longer deliveries towards a forward outlet.', {direct: 0.34});
const setKeeper = role('line-keeper', 'Goalkeeper', 'Set up on the usual line and narrow the angle against a runner.');
const sweeper = role('sweeper-keeper', 'Sweeper keeper', 'Start higher as the ball travels away from goal and attack the space behind the line.', {sweep: 0.13});
const deepKeeper = role('stay-home-keeper', 'Line-holding keeper', 'Stay closer to the goal line while the defence drops back.', {sweep: -0.085});

const cb = role('centre-back', 'Centre-back', 'Support circulation behind the midfield.');
const passingBack = role('ball-playing-defender', 'Ball-playing centre-back', 'Look for a forward pass that takes opponents out of the game.', {direct: 0.22, through: 0.10});
const steppingBack = role('libero', 'Advanced centre-back', 'Move ahead of the back line into midfield as the team advances.', {advance: 11, narrow: 0.48, shortPass: 0.13});
const wideBack = role('overlapping-centre-back', 'Overlapping centre-back', 'Push into a wider lane in support of attacks and look for a delivery.', {advance: 11, flank: 9, cross: 0.12});
const blockingBack = role('central-defender', 'Central defender', 'Keep station in the defensive line.');
const stopper = role('stopper', 'Stopping centre-back', 'Step out early to meet the ball carrier.', {depth: 3, press: 1.35});
const cover = role('covering-centre-back', 'Covering centre-back', 'Drop behind the line and protect the space behind the defender engaging the ball.', {depth: -5, press: 0.72, cover: 'centre'});
const defendingWideCB = role('defending-wide-centre-back', 'Wide centre-back', 'Guard the outside channel in a back three and pick up an opponent breaking into it.', {mark: 'channel', press: 0.94});
const stoppingWideCB = role('stopping-wide-centre-back', 'Stopping wide centre-back', 'Step out from a back three and meet the ball or the runner in your channel.', {depth: 4, press: 1.45, mark: 'channel'});
const coveringWideCB = role('covering-wide-centre-back', 'Covering wide centre-back', 'Protect the channel behind the player stepping out and cover the run past them.', {depth: -5, press: 0.66, cover: 'channel'});

const fullback = role('full-back', 'Full-back', 'Give the build-up width and support the player ahead.');
const wingback = role('wing-back', 'Wing-back', 'Run beyond the wide midfielder to offer an overlap and a cross.', {advance: 12, flank: 3, cross: 0.17});
const invertedBack = role('inside-wing-back', 'Inside wing-back', 'Start wide and move into a central passing lane as the ball advances.', {advance: 6, narrow: 0.74, shortPass: 0.13});
const playmakingBack = role('playmaking-wing-back', 'Playmaking wing-back', 'Come inside to receive the ball and search for incisive forward passes.', {advance: 4, narrow: 0.49, attract: 0.10, through: 0.14});
const defensiveBack = role('defending-full-back', 'Full-back', 'Defend the flank at the height of the back line.');
const pressingBack = role('pressing-full-back', 'Pressing full-back', 'Step up to engage the wide ball carrier earlier.', {depth: 4, press: 1.35});
const holdingBack = role('holding-full-back', 'Holding full-back', 'Stay goal-side and tuck inside to help the centre-backs.', {depth: -2, narrow: 0.25, press: 0.76});
const pressingWingBack = role('pressing-wing-back', 'Pressing wing-back', 'Jump from the flank to pressure the ball before the opponent can advance.', {depth: 5, press: 1.47});
const holdingWingBack = role('holding-wing-back', 'Holding wing-back', 'Hold the wide defensive lane and cover behind a teammate who steps out.', {depth: -3, press: 0.72, cover: 'channel'});

const midfielder = role('central-midfielder', 'Central midfielder', 'Connect the defence and attack from a central position.');
const deepPlaymaker = role('deep-lying-playmaker', 'Deep-lying playmaker', 'Show for the ball behind midfield and launch forward passes.', {depth: -6, attract: 0.13, through: 0.14});
const boxToBox = role('box-to-box', 'Box-to-box midfielder', 'Join the front line as the ball enters the final third.', {advance: 12, run: 4, finish: 0.025});
const channelMid = role('channel-midfielder', 'Channel midfielder', 'Move into a wider half-space to link or deliver from the channel.', {advance: 5, flank: 8, cross: 0.08});
const playmaker = role('advanced-playmaker', 'Advanced playmaker', 'Find space between the lines, receive to feet and look for through balls.', {depth: 3, attract: 0.13, through: 0.19, shortPass: 0.04});
const freeRole = role('free-role', 'Free role', 'Drift towards the ball across the attacking line and look for runners from the pocket.', {depth: -3, roam: 0.50, attract: 0.11, through: 0.16});
const pivot = role('defensive-midfielder', 'Defensive midfielder', 'Offer a passing outlet in front of the defence.');
const halfBack = role('half-back', 'Half-back', 'Drop centrally towards the centre-backs to help build from deep.', {depth: -8, narrow: 0.4, shortPass: 0.12});
const holdingMid = role('central-cover', 'Central midfielder', 'Recover to the midfield line and protect the centre.');
const screeningMid = role('screening-midfielder', 'Screening central midfielder', 'Hold centrally and cut the passing lane to an opponent between the lines.', {depth: -4, narrow: 0.25, press: 0.70, screen: true});
const ballWinner = role('pressing-midfielder', 'Pressing midfielder', 'Leave the line to engage when the ball is within pressing distance.', {depth: 4, press: 1.44});
const shuttle = role('wide-cover-midfielder', 'Wide-covering central midfielder', 'Cover behind a teammate pressing out wide and defend the inside route past them.', {followBall: 0.38, press: 0.93, cover: 'flank'});
const droppingMid = role('dropping-defensive-midfielder', 'Dropping defensive midfielder', 'Drop in among the centre-backs as play reaches your defensive third.', {dropIntoLine: true, press: 0.76});

const wideMid = role('wide-midfielder', 'Wide midfielder', 'Offer a link along the flank and support the full-back.');
const winger = role('winger', 'Winger', 'Stay wide, carry down the flank and look for crosses.', {flank: 4, carry: 0.11, cross: 0.20});
const inside = role('inside-forward', 'Inside forward', 'Cut inside with the ball and arrive closer to goal to finish.', {advance: 6, narrow: 0.52, carry: 0.13, cutInside: 3.8, finish: 0.065});
const invertedWing = role('inverted-winger', 'Inside winger', 'Carry infield from wide positions and look for a through ball.', {narrow: 0.34, carry: 0.11, cutInside: 3.5, through: 0.12});
const wideMaker = role('wide-playmaker', 'Playmaking winger', 'Drift inside from the wing to receive and create for runners.', {narrow: 0.56, attract: 0.11, through: 0.16});
const defendingWide = role('wide-defender', 'Wide midfielder', 'Recover into the wide defensive lane.');
const tracking = role('tracking-winger', 'Tracking winger', 'Recover with an opponent advancing down your flank and get goal-side of the run.', {depth: -8, followBall: 0.14, mark: 'flank'});
const outlet = role('outlet', 'Counterattacking outlet', 'Stay higher as the block drops to give the next regain a forward target.', {outlet: true, press: 0.68});
const wideOutlet = role('wide-outlet', 'Wide-outlet winger', 'Stay high on the touchline to receive a breakout pass.', {outlet: 'wide', press: 0.62});
const invertingOutlet = role('inverting-outlet-winger', 'Inside outlet winger', 'Stay high but come inside to offer a forward pass through the middle.', {outlet: 'inside', press: 0.62});
const centralOutlet = role('central-outlet', 'Central-outlet centre forward', 'Stay up between the centre-backs to receive the first forward pass.', {outlet: 'central', press: 0.62});
const splittingOutlet = role('splitting-outlet-centre-forward', 'Splitting-outlet centre forward', 'Stay high and peel outside the centre-back into the channel for the counter.', {outlet: 'split', press: 0.62});

const ten = role('attacking-midfielder', 'Attacking midfielder', 'Offer a central option between midfield and attack.');
const secondStriker = role('second-striker', 'Second striker', 'Run past the striker and attack the box as a second finisher.', {advance: 11, run: 6, finish: 0.06});
const nine = role('centre-forward', 'Centre forward', 'Lead the line and offer both a run and a pass to feet.');
const poacher = role('poacher', 'Poacher', 'Play on the last shoulder and favour a first-time finish in the box.', {advance: 7, run: 7, finish: 0.09});
const falseNine = role('false-nine', 'False nine', 'Leave the front line to receive between the lines and release runners.', {depth: -11, run: -10, attract: 0.12, through: 0.17, finish: -0.045});
const linkForward = role('deep-lying-forward', 'Deep-lying forward', 'Drop off the centre-backs, receive to feet and lay off to close support.', {depth: -6, run: -3, attract: 0.09, shortPass: 0.18});
const target = role('target-forward', 'Target forward', 'Show for long deliveries and lay the ball off to close support.', {depth: -2, aerialTarget: 0.25, shortPass: 0.15, run: -4});
const channel = role('channel-forward', 'Channel forward', 'Peel into the channel beyond a centre-back to receive on the move.', {flank: 8, advance: 4, run: 6});
const leading = role('front-line', 'Centre forward', 'Lead the first line of defence from the usual starting position.');
const pressingForward = role('pressing-forward', 'Pressing forward', 'Close the ball earlier to hurry the opposition build-up.', {depth: 3, press: 1.5});
const trackingForward = role('tracking-forward', 'Tracking centre forward', 'Recover into midfield and pick up the free opposition pivot.', {depth: -9, narrow: 0.20, mark: 'pivot'});

// Some FM roles have the same instruction in a different line. The existing
// assignment ID is retained so previously submitted team sheets still work.
const named = ([id, data], label) => [id, {...data, label}];

function phases(attacking, defending) {
  return {inPossession: Object.fromEntries(attacking), outOfPossession: Object.fromEntries(defending)};
}
export const roleCatalog = {
  goalkeeper: phases([keeper, distributor, clearingKeeper], [setKeeper, sweeper, deepKeeper]),
  centreBack: phases([cb, passingBack, steppingBack, wideBack, noNonsenseCB], [blockingBack, stopper, cover]),
  fullBack: phases([fullback, wingback, invertedBack, playmakingBack, insideFullback], [defensiveBack, pressingBack, holdingBack]),
  wingBack: phases([wingback, fullback, invertedBack, playmakingBack, advancedWingback], [named(defensiveBack, 'Wing-back'), pressingWingBack, holdingWingBack, pressingBack, holdingBack, tracking]),
  defensiveMidfield: phases([pivot, deepPlaymaker, halfBack, boxToBox, boxPlaymaker], [named(holdingMid,'Defensive midfielder'), droppingMid,
    named(screeningMid,'Screening defensive midfielder'), named(ballWinner,'Pressing defensive midfielder'), named(shuttle,'Wide-covering defensive midfielder')]),
  centralMidfield: phases([midfielder, deepPlaymaker, boxToBox, channelMid, playmaker, midfieldMaker, wideCentralMid], [holdingMid, screeningMid, named(ballWinner,'Pressing central midfielder'), shuttle]),
  wideMidfield: phases([wideMid, winger, invertedWing, wideMaker], [defendingWide, named(tracking,'Tracking wide midfielder'), named(wideOutlet,'Wide-outlet wide midfielder'), outlet]),
  attackingMidfield: phases([ten, playmaker, freeRole, secondStriker], [named(holdingMid,'Attacking midfielder'), named(trackingForward,'Tracking attacking midfielder'),
    named(centralOutlet,'Central-outlet attacking midfielder'), named(splittingOutlet,'Splitting-outlet attacking midfielder'), pressingForward, outlet]),
  wideForward: phases([winger, inside, invertedWing, wideMaker, channel, freeRole, wideForward], [named(defendingWide,'Winger'), tracking, wideOutlet, invertingOutlet, pressingForward, outlet]),
  striker: phases([nine, poacher, falseNine, linkForward, target, channel, freeRole], [leading, trackingForward, centralOutlet, splittingOutlet, pressingForward, outlet])
};
roleCatalog.wideCentreBack = {
  inPossession: {...roleCatalog.centreBack.inPossession, ...Object.fromEntries([wideCB])},
  outOfPossession: {...roleCatalog.centreBack.outOfPossession, ...Object.fromEntries([defendingWideCB, stoppingWideCB, coveringWideCB])}
};
export const roleFamilies = Object.fromEntries(Object.entries({
  goalkeeper: ['GK'], centreBack: ['CB','LCB','RCB','DC','DF'], fullBack: ['LB','RB','DL','DR'],
  wingBack: ['LWB','RWB','WBL','WBR'], defensiveMidfield: ['DM','LDM','RDM','DMCL','DMCR'],
  centralMidfield: ['CM','LCM','RCM','MF'], attackingMidfield: ['AM','CAM','AMC','LAM','RAM'],
  wideMidfield: ['LM','RM'], wideForward: ['LW','RW','AML','AMR'], striker: ['ST','LS','RS','CF','FW']
}).flatMap(([family, slots]) => slots.map(slot => [slot, family])));
export const slotFamily = slot => roleFamilies[slot];
export function roleChoices(slot, {wideCentreBack = false} = {}) {
  const outsideOfThree = wideCentreBack && (slot === 'LCB' || slot === 'RCB');
  return roleCatalog[outsideOfThree ? 'wideCentreBack' : slotFamily(slot)];
}

const neutral = {};
const defaults = Object.fromEntries(Object.entries(roleCatalog).map(([family, phases]) =>
  [family, Object.fromEntries(Object.entries(phases).map(([phase, roles]) => [phase, Object.keys(roles)[0]]))]));
export function roleEffects(player, inPossession) {
  const key = inPossession ? 'inPossession' : 'outOfPossession';
  const slot = inPossession ? player.slot : player.defensiveSlot ?? player.slot;
  return profiles[player.roles?.[key] ?? defaults[slotFamily(slot)]?.[key]] ?? neutral;
}
