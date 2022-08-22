// binary search
function binarySearch(arr: number[], target: number) {
  let low = 0;
  let high = arr.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (arr[mid] === target) {
      return mid;
    }
    if (arr[mid] < target) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return -1;
}

// quick sort
function quickSort(arr: number[]): number[] {
  if (arr.length <= 1) {
    return arr;
  }
  const pivot = arr[0];
  const left = [];
  const right = [];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < pivot) {
      left.push(arr[i]);
    } else {
      right.push(arr[i]);
    }
  }
  return quickSort(left).concat(pivot, quickSort(right));
}

// sort
const arr = [];
for (let i = 0; i < 50; i++) {
  arr.push(Math.random() * 50);
}
const sortedArr = quickSort(arr);
console.log(sortedArr);

//search
console.log(binarySearch(sortedArr, sortedArr[Math.floor(Math.random() * 50)]));
