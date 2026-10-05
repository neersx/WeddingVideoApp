import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {resolveWeddingStyle} from './styles';

const style = (weddingCulture: string, weddingTradition = '', videoStyle = '') =>
  resolveWeddingStyle({fields: {weddingCulture, weddingTradition, videoStyle}}).id;

test('resolves culture and tradition with tradition taking precedence', () => {
  assert.equal(style('Indian', 'Hindu'), 'indian-royal');
  assert.equal(style('English', 'Christian'), 'english-garden');
  assert.equal(style('Indian', 'Christian'), 'english-garden');
  assert.equal(style('Indian', 'Muslim'), 'emerald-arches');
  assert.equal(style('Indian', 'Buddhist'), 'lotus-serenity');
  assert.equal(style('Indian', 'Interfaith'), 'neutral-romance');
});
test('handles aliases, whitespace and denomination labels', () => {
  assert.equal(style(' BRITISH '), 'english-garden');
  assert.equal(style('English Christian'), 'english-garden');
  assert.equal(style('Indian', 'Tamil Hindu'), 'indian-royal');
  assert.equal(style('Indian', 'Roman Catholic'), 'english-garden');
});
test('explicit presets override metadata and invalid presets fall back safely', () => {
  assert.equal(style('Indian', 'Hindu', 'forest-gold'), 'forest-gold');
  assert.equal(style('English', 'Christian', 'invalid'), 'english-garden');
  assert.equal(style('unknown', 'unknown'), 'neutral-romance');
  assert.equal(style('', ''), 'neutral-romance');
  assert.equal(style('__proto__', 'constructor', 'toString'), 'neutral-romance');
});
test('normalized payloads preserve tradition and explicit flat fields override nested values', () => {
  const dreamwedds = {culture:'indian', tradition:'Christian', videoStyle:''};
  assert.equal(resolveWeddingStyle({fields:{dreamwedds}}).id, 'english-garden');
  assert.equal(resolveWeddingStyle({fields:{dreamwedds, weddingTradition:'Hindu'}}).id, 'indian-royal');
  assert.equal(resolveWeddingStyle({fields:{dreamwedds:{...dreamwedds,videoStyle:'forest-gold'}}}).id, 'forest-gold');
});
