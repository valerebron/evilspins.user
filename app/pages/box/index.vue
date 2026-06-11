<template>
  <div class='case'>
    <div class='box box--bordered box--case-body'>
      <div class='wall wall--right'></div>
      <div class='wall wall--back'></div>
    </div>
    <div class='box box--bordered box--shell'>
      <div class='wall wall--right'></div>
      <div class='wall wall--back'></div>
    </div>
    <div class='box box--cards'>
      <div class='card card--red'></div>
      <div class='card card--pink'></div>
      <div class='card card--orange'></div>
      <div class='card card--green'></div>
      <div class='card card--purple'></div>
      <div class='card card--purple'></div>
      <div class='card card--purple'></div>
      <div class='card card--purple'></div>
      <div class='card card--purple'></div>
      <div class='card card--purple'></div>
      <div class='card card--purple'></div>
      <div class='card card--purple card--face'></div>
    </div>
    <div class='box box--bordered box--shell'>
      <div class='wall wall--left'></div>
      <div class='wall wall--front'></div>
    </div>
    <div class='box box--bordered box--case-body'>
      <div class='wall wall--left'></div>
      <div class='wall wall--front'></div>
    </div>
    <div class='box box--case-lip'>
      <div class='wall wall--top'></div>
      <div class='wall wall--left'></div>
      <div class='wall wall--front'></div>
    </div>
  </div>

</template>

<script setup>
// https://codepen.io/z10n/pen/eYPZzQY
import { onMounted, onUnmounted } from 'vue'

const xRangeDeg = [60, 5]
const yRangeDeg = [-20, -5]

function getCasePosition(targetPosition, bodyPosition, range) {
  const positionPercent = Math.round((targetPosition / bodyPosition) * 100)
  const [min, max] = range

  return (positionPercent * (max - min)) / 100 + min
}

function changeCasePerspective(x, y, $body, $case) {
  const box = $body.getBoundingClientRect()
  const calcX = getCasePosition(y, box.height, yRangeDeg)
  const calcY = getCasePosition(x, box.width, xRangeDeg)

  $case.style.setProperty('--box-rotate-x', calcX + 'deg')
  $case.style.setProperty('--box-rotate-y', calcY + 'deg')
}

onMounted(() => {
  const $body = document.body
  const $case = document.querySelector(".case")

  const handleMouseMove = (event) => {
    changeCasePerspective(event.clientX, event.clientY, $body, $case)
  }

  const handleTouchMove = (event) => {
    const touch = event.targetTouches[0]
    changeCasePerspective(touch.pageX, touch.pageY, $body, $case)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener("touchmove", handleTouchMove)

  onUnmounted(() => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener("touchmove", handleTouchMove)
  })
})

</script>

<style lang="scss">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --box-rotate-x: -16deg;
  --box-rotate-y: 36deg;
}

body {
  background: #f7f7f7 radial-gradient(circle at 50%, #f5f5f5 65%, #e9e9e9);
  height: 100vh;
  display: grid;
  place-content: center;
}

.case {
  display: flex;
  height: 484px;
  perspective: 5000px;
  position: relative;
  justify-content: center;
  transform: translateY(20px);
}

.case:hover .box--case-lip {
  transform: rotateX(var(--box-rotate-x)) rotateY(var(--box-rotate-y)) translateY(-260px);
}

.case:hover .box--cards {
  transform: rotateX(var(--box-rotate-x)) rotateY(var(--box-rotate-y)) translateZ(-41.4px) translateY(-30px);
}

.case:hover .card {
  -webkit-animation: wave-cards 5s var(--card-delay) ease-in-out infinite;
  animation: wave-cards 5s var(--card-delay) ease-in-out infinite;
}

.wall {
  position: absolute;
  height: var(--box-height);
  transform-style: preserve-3d;
  background-color: #fff;
}

.wall--top,
.wall--front,
.wall--back {
  width: var(--box-length);
}

.wall--right,
.wall--left {
  width: var(--box-width);
}

.wall--top {
  height: var(--box-width);
  transform: translateY(calc(var(--box-width) / 2 * -1)) rotateX(90deg);
}

.wall--front {
  transform: translateZ(calc(var(--box-width) / 2));
}

.wall--right {
  transform: translateX(calc(var(--box-length) / 2)) rotateY(90deg);
}

.wall--left {
  transform: translateX(calc(var(--box-length) / -2)) rotateY(-90deg);
}

.wall--back {
  transform: translateZ(calc(var(--box-width) / 2 * -1));
}

.box {
  position: absolute;
  transform-style: preserve-3d;
  transform: rotateX(var(--box-rotate-x)) rotateY(var(--box-rotate-y));
  display: flex;
  justify-content: center;
  transition: transform 350ms cubic-bezier(0.01, 1.1, 1, 1);
  will-change: transform;
}

.box--case-lip .wall,
.box--case-lip .wall::before,
.box--case-body .wall,
.box--case-body .wall::before {
  background-image: url("box.jpeg");
  background-repeat: no-repeat;
  background-size: 400px;
}

.box--case-lip {
  --box-length: 286px;
  --box-width: 114px;
  --box-height: 125px;
  pointer-events: none;
}

.box--case-lip .wall--top {
  background-color: #ebebf4;
  background-position: top right;
}

.box--case-lip .wall--front,
.box--case-lip .wall--back {
  background-position: -114px -114px;
}

.box--case-lip .wall--right,
.box--case-lip .wall--left {
  background-color: #cbcacf;
  background-position: 0 -114px;
}

.box--case-body {
  --box-length: 286px;
  --box-width: 114px;
  --box-height: 359px;
  transform: rotateX(var(--box-rotate-x)) rotateY(var(--box-rotate-y)) translateY(125px);
}

.box--case-body .wall--front,
.box--case-body .wall--back,
.box--case-body .wall--front::before,
.box--case-body .wall--back::before {
  background-position: -114px -239px;
}

.box--case-body .wall--right,
.box--case-body .wall--left,
.box--case-body .wall--right::before,
.box--case-body .wall--left::before {
  background-color: #cbcacf;
  background-position: 0 -239px;
}

.box--shell {
  --box-length: 270px;
  --box-width: 98px;
  --box-height: 384px;
  transform: rotateX(var(--box-rotate-x)) rotateY(var(--box-rotate-y)) translateY(92px);
}

.box--shell .wall--front {
  background-color: #a4bad8;
}

.box--shell .wall--front::before {
  background-color: #98afcc;
}

.box--shell .wall--left {
  background-color: #7c96b7;
}

.box--shell .wall--left::before {
  background-color: #b3bfd1;
}

.box--shell .wall--right,
.box--shell .wall--right::before {
  background-color: #737b91;
}

.box--shell .wall--back,
.box--shell .wall--back::before {
  background-color: #92a0c8;
}

.box--case-body .wall--left::after,
.box--shell .wall--left::after {
  content: "";
  position: absolute;
  right: 18px;
  left: 18px;
  height: 6px;
  transform-origin: top;
  transform: translateY(6px) translateZ(-8px);
  box-shadow: 0 0 8px 5px rgba(0, 0, 0, 0.1);
}

.box--bordered .wall::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top;
  width: 100%;
  height: 6px;
  transform: rotateX(-90deg);
}

.box--bordered .wall--back::before {
  transform: rotateX(90deg);
}

.box--cards {
  transform: rotateX(var(--box-rotate-x)) rotateY(var(--box-rotate-y)) translateZ(-41.4px) translateY(65px);
}

.card {
  width: 250px;
  height: 411px;
  position: absolute;
  background-color: #fff;
  border-radius: 20px;
  box-shadow: -1px 0 0 1px rgba(0, 0, 0, 0.08), 0 -1px 0 1px rgba(255, 255, 255, 0.16);
  transform: translateZ(var(--translate-z));
  background-size: contain;
  overflow: hidden;
}

.card--purple {
  background-color: #8594c3;
}

.card--green {
  background-color: #99bb49;
}

.card--orange {
  background-color: #f3a541;
}

.card--pink {
  background-color: #e79bbc;
}

.card--red {
  background-color: #cf2534;
}

.card--face {
  background-image: url("https://i.imgur.com/zmFFF5h.jpg");
}

.card:nth-child(36) {
  --translate-z: 82.8px;
  --card-delay: 0ms;
}

.card:nth-child(35) {
  --translate-z: 80.5px;
  --card-delay: 15ms;
}

.card:nth-child(34) {
  --translate-z: 78.2px;
  --card-delay: 30ms;
}

.card:nth-child(33) {
  --translate-z: 75.9px;
  --card-delay: 45ms;
}

.card:nth-child(32) {
  --translate-z: 73.6px;
  --card-delay: 60ms;
}

.card:nth-child(31) {
  --translate-z: 71.3px;
  --card-delay: 75ms;
}

.card:nth-child(30) {
  --translate-z: 69px;
  --card-delay: 90ms;
}

.card:nth-child(29) {
  --translate-z: 66.7px;
  --card-delay: 105ms;
}

.card:nth-child(28) {
  --translate-z: 64.4px;
  --card-delay: 120ms;
}

.card:nth-child(27) {
  --translate-z: 62.1px;
  --card-delay: 135ms;
}

.card:nth-child(26) {
  --translate-z: 59.8px;
  --card-delay: 150ms;
}

.card:nth-child(25) {
  --translate-z: 57.5px;
  --card-delay: 165ms;
}

.card:nth-child(24) {
  --translate-z: 55.2px;
  --card-delay: 180ms;
}

.card:nth-child(23) {
  --translate-z: 52.9px;
  --card-delay: 195ms;
}

.card:nth-child(22) {
  --translate-z: 50.6px;
  --card-delay: 210ms;
}

.card:nth-child(21) {
  --translate-z: 48.3px;
  --card-delay: 225ms;
}

.card:nth-child(20) {
  --translate-z: 46px;
  --card-delay: 240ms;
}

.card:nth-child(19) {
  --translate-z: 43.7px;
  --card-delay: 255ms;
}

.card:nth-child(18) {
  --translate-z: 41.4px;
  --card-delay: 270ms;
}

.card:nth-child(17) {
  --translate-z: 39.1px;
  --card-delay: 285ms;
}

.card:nth-child(16) {
  --translate-z: 36.8px;
  --card-delay: 300ms;
}

.card:nth-child(15) {
  --translate-z: 34.5px;
  --card-delay: 315ms;
}

.card:nth-child(14) {
  --translate-z: 32.2px;
  --card-delay: 330ms;
}

.card:nth-child(13) {
  --translate-z: 29.9px;
  --card-delay: 345ms;
}

.card:nth-child(12) {
  --translate-z: 27.6px;
  --card-delay: 360ms;
}

.card:nth-child(11) {
  --translate-z: 25.3px;
  --card-delay: 375ms;
}

.card:nth-child(10) {
  --translate-z: 23px;
  --card-delay: 390ms;
}

.card:nth-child(9) {
  --translate-z: 20.7px;
  --card-delay: 405ms;
}

.card:nth-child(8) {
  --translate-z: 18.4px;
  --card-delay: 420ms;
}

.card:nth-child(7) {
  --translate-z: 16.1px;
  --card-delay: 435ms;
}

.card:nth-child(6) {
  --translate-z: 13.8px;
  --card-delay: 450ms;
}

.card:nth-child(5) {
  --translate-z: 11.5px;
  --card-delay: 465ms;
}

.card:nth-child(4) {
  --translate-z: 9.2px;
  --card-delay: 480ms;
}

.card:nth-child(3) {
  --translate-z: 6.9px;
  --card-delay: 495ms;
}

.card:nth-child(2) {
  --translate-z: 4.6px;
  --card-delay: 510ms;
}

.card:nth-child(1) {
  --translate-z: 2.3px;
  --card-delay: 525ms;
}

@-webkit-keyframes wave-cards {

  84%,
  100% {
    transform: translateZ(var(--translate-z)) translateY(0);
  }

  92% {
    transform: translateZ(var(--translate-z)) translateY(-25px);
  }
}

@keyframes wave-cards {

  84%,
  100% {
    transform: translateZ(var(--translate-z)) translateY(0);
  }

  92% {
    transform: translateZ(var(--translate-z)) translateY(-25px);
  }
}
</style>
