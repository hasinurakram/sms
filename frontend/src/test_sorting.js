
const testSorting = () => {
  const students = [
    { roll_number: '10' },
    { roll_number: '2' },
    { roll_number: '' },
    { roll_number: null },
    { roll_number: '1' },
    { roll_number: 'A-1' },
    { roll_number: 'A-2' },
    { roll_number: '20' },
    { roll_number: undefined },
    { roll_number: 'B-1' },
    { roll_number: '100' },
    { roll_number: '  ' }
  ];

  const sorted = [...students].sort((a, b) => {
    const rA = String(a?.roll_number ?? '').trim();
    const rB = String(b?.roll_number ?? '').trim();

    const emptyA = !rA;
    const emptyB = !rB;

    if (emptyA && !emptyB) return 1;
    if (!emptyA && emptyB) return -1;
    if (emptyA && emptyB) return 0;

    const ar = parseInt(rA.replace(/\D/g, ''), 10);
    const br = parseInt(rB.replace(/\D/g, ''), 10);

    const aNum = Number.isNaN(ar) ? null : ar;
    const bNum = Number.isNaN(br) ? null : br;

    if (aNum !== null && bNum !== null && aNum !== bNum) {
        return aNum - bNum;
    }

    return rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
  });

  console.log('Sorted Result:');
  sorted.forEach(s => console.log(`"${s.roll_number}"`));
};

testSorting();
