import * as THREE from 'three';

/**
 * The neighbours who come out to watch the show.
 *
 * They are deliberately simple box-and-sphere people who line up behind the
 * fence. Every firework brings a few more out, and a big burst makes the whole
 * row bounce and cheer. Their phone lights only glow at night.
 */

const SKIN = [0xffd2a8, 0xe8b184, 0xc28a5a, 0x9a663c, 0x6f4526];
const SHIRTS = [0xff2e63, 0x2ec4ff, 0x3ddc84, 0xffd93d, 0xa855f7, 0xff8a00, 0xef476f, 0x06d6a0];
const HATS = [0x222233, 0xffd93d, 0xff2e63, 0x2ec4ff, 0x3ddc84];

export function createCrowd(scene, { max = 40 } = {}) {
  const group = new THREE.Group();
  group.name = 'crowd';
  scene.add(group);

  const people = [];
  const slots = [];

  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i < 20; i += 1) {
      slots.push({
        x: -9.5 + i * 1.0 + (row === 1 ? 0.5 : 0),
        z: -7 - row * 1.05,
      });
    }
  }

  const skinMats = SKIN.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  const shirtMats = SHIRTS.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  const hatMats = HATS.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.75 }));
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x2a1b12, roughness: 0.9 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2b2b3d, roughness: 0.9 });
  const phoneMat = new THREE.MeshStandardMaterial({
    color: 0xe8f4ff,
    emissive: 0x9fd8ff,
    emissiveIntensity: 2,
    transparent: true,
    opacity: 1,
    roughness: 0.35,
  });

  const bodyGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.72, 6);
  const headGeo = new THREE.SphereGeometry(0.19, 8, 6);
  const armGeo = new THREE.BoxGeometry(0.09, 0.48, 0.09).translate(0, -0.24, 0);
  const legGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);
  const phoneGeo = new THREE.BoxGeometry(0.1, 0.16, 0.03);
  const hatGeo = new THREE.ConeGeometry(0.2, 0.24, 6);
  const hairGeo = new THREE.SphereGeometry(0.2, 8, 6);

  function makePerson(index) {
    const person = new THREE.Group();
    const skin = skinMats[index % skinMats.length];
    const shirt = shirtMats[index % shirtMats.length];

    const body = new THREE.Mesh(bodyGeo, shirt);
    body.position.y = 0.92;
    body.castShadow = true;
    person.add(body);

    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.11, 0.3, 0);
    person.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.11, 0.3, 0);
    person.add(rightLeg);

    const head = new THREE.Mesh(headGeo, skin);
    head.position.y = 1.42;
    head.castShadow = true;
    person.add(head);

    const armL = new THREE.Mesh(armGeo, skin);
    armL.position.set(-0.27, 1.28, 0);
    armL.rotation.z = -0.15;
    person.add(armL);

    const armR = new THREE.Mesh(armGeo, skin);
    armR.position.set(0.27, 1.28, 0);
    armR.rotation.z = 0.15;
    person.add(armR);

    if (index % 3 === 0) {
      const hat = new THREE.Mesh(hatGeo, hatMats[index % hatMats.length]);
      hat.position.y = 1.62;
      hat.rotation.y = Math.random() * Math.PI;
      person.add(hat);
    } else {
      const hair = new THREE.Mesh(hairGeo, hairMat);
      hair.position.y = 1.47;
      hair.scale.set(1, 0.65, 1);
      person.add(hair);
    }

    const phone = new THREE.Mesh(phoneGeo, phoneMat);
    phone.position.set(0.4, 1.02, 0.16);
    phone.rotation.z = 0.25;
    person.add(phone);

    person.userData = {
      phase: Math.random() * Math.PI * 2,
      speed: 1.6 + Math.random() * 1.2,
      excitement: 0,
      armL,
      armR,
    };

    return person;
  }

  function add(count) {
    const limit = Math.min(max, slots.length);
    for (let i = 0; i < count && people.length < limit; i += 1) {
      const slot = slots[people.length];
      const person = makePerson(people.length);
      person.position.set(slot.x, 0, slot.z);
      person.rotation.y = (Math.random() - 0.5) * 0.45;
      person.scale.setScalar(1.02 + Math.random() * 0.12);
      group.add(person);
      people.push(person);
    }
    return people.length;
  }

  function reset() {
    people.forEach((person) => group.remove(person));
    people.length = 0;
  }

  function cheer(strength = 1) {
    people.forEach((person) => {
      person.userData.excitement = Math.min(1.6, person.userData.excitement + strength);
    });
  }

  function update(dt, time, night = 1) {
    phoneMat.opacity = 0.15 + night * 0.85;
    phoneMat.emissiveIntensity = 0.4 + night * 2.2;

    for (const person of people) {
      const ud = person.userData;
      ud.excitement = Math.max(0, ud.excitement - dt * 1.15);

      const bounce =
        Math.sin(time * ud.speed + ud.phase) * 0.025 +
        Math.abs(Math.sin(time * 9 + ud.phase)) * 0.11 * ud.excitement;

      person.position.y = bounce;
      ud.armL.rotation.z = -0.15 - ud.excitement * 1.85;
      ud.armR.rotation.z = 0.15 + ud.excitement * 1.85;
      person.rotation.z = Math.sin(time * 7 + ud.phase) * 0.03 * ud.excitement;
    }
  }

  return {
    get count() {
      return people.length;
    },
    add,
    reset,
    cheer,
    update,
  };
}
