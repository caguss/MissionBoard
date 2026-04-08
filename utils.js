// 범용 유틸리티 함수 모음 — 재사용 가능하도록 전역 `Utils`에 노출
(function(){
  /**
   * DOM 선택자 - 단일 요소
   * @param {string} sel - 선택자
   * @returns {Element|null}
   */
  function $(sel){ return document.querySelector(sel) }

  /**
   * DOM 선택자 - 복수 요소를 배열로 반환
   * @param {string} sel - 선택자
   * @returns {Element[]}
   */
  function $$(sel){ return Array.from(document.querySelectorAll(sel)) }

  /**
   * 고유 ID 생성기
   * @returns {string} 난수 기반 고유 문자열
   */
  function id(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6) }

  /**
   * 현재 시간 ISO 문자열
   * @returns {string}
   */
  function now(){ return new Date().toISOString() }

  /**
   * ISO 시간 문자열을 사용자 로캘 형식으로 포맷
   * @param {string} iso
   * @returns {string}
   */
  function fmt(iso){ const d=new Date(iso); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}년${p(d.getMonth()+1)}월${p(d.getDate())}일 ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` }

  /**
   * 디바운스 헬퍼 - 빈번한 호출을 제한
   * @param {Function} fn
   * @param {number} ms
   * @returns {Function}
   */
  function debounce(fn, ms=200){ let t; return (...a)=>{ clearTimeout(t); t = setTimeout(()=>fn(...a), ms) } }

  window.Utils = { $, $$, id, now, fmt, debounce }
})();
