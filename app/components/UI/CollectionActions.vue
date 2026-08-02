<template>
  <div class="collection-actions">
    <button class="btn border-black">
      <CreateCardSVG />
      Create card
    </button>

    <button class="btn border-black">
      <printSVG />
      Print
    </button>

    <!-- Google -->
    <button class="btn border-black">
      <MixSVG />
      Mix
    </button>

    <button class="btn border-black">
      <NfcSVG />
      NFC
    </button>
  </div>
</template>
<style scoped>
.collection-actions {
  width: 100%;
  justify-content: space-around;
  max-width: 500px;
  display: flex;
}

.icon {
  height: 30px;
}
</style>