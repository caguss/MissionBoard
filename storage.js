// 로컬 스토리지 저장소 추상화 — 키를 사용하여 load/save 제공
(function(){
  /**
   * 주어진 키로 로컬스토리지에서 JSON을 파싱하여 반환
   * @param {string} key
   * @returns {any}
   */
  function load(key){
    try{ return JSON.parse(localStorage.getItem(key) || 'null') || [] }catch(e){ return [] }
  }

  /**
   * 주어진 키로 데이터를 JSON 문자열화하여 로컬스토리지에 저장
   * @param {string} key
   * @param {any} data
   */
  function save(key, data){
    try{ localStorage.setItem(key, JSON.stringify(data)) }catch(e){ console.error('Storage save failed', e) }
  }

  window.StorageAPI = { load, save }
})();
