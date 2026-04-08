(function(){
  const KEY = 'qa_posts_v1'
  const SEQ_KEY = 'qa_seq_v1'
  const $ = Utils.$
  const $$ = Utils.$$
  const id = Utils.id
  const now = Utils.now
  const fmt = Utils.fmt
  const debounce = Utils.debounce

  // State
  let posts = []
  let editing = null
  let replyingTo = null

  // Elements - 상단 공통
  const topLoginUser = $('#topLoginUser')
  const loginUserDisplay = $('#loginUserDisplay')
  const postsEl = $('#posts')
  const postTemplate = $('#postTemplate')
  const searchIn = $('#search')
  const emptyState = $('#emptyState')
  const sortSelect = $('#sortSelect')

  // Elements - div composer
  const composer = $('#composer')
  const postForm = $('#postForm')
  const authorIn = $('#loginUser')
  const titleIn = $('#postTitle')
  const contentIn = $('#postContent')
  const cancelBtn = $('#cancelBtn')
  const composerTitle = $('#composerTitle')
  const loginUserBadge = $('#loginUserBadge')
  const cityIn = $('#cites')

  // Elements - modal
  const modalOverlay = $('#modalOverlay')
  const modalPostForm = $('#modalPostForm')
  const modalTitleIn = $('#modalPostTitle')
  const modalContentIn = $('#modalPostContent')
  const modalCityIn = $('#modalCites')
  const modalCloseBtn = $('#modalCloseBtn')
  const modalCancelBtn = $('#modalCancelBtn')

  // Buttons
  const newPostDivBtn = $('#newPostDivBtn')
  const newPostPopupBtn = $('#newPostPopupBtn')
  const newPostModalBtn = $('#newPostModalBtn')

  // ─── Persistence ──────────────────────────────────────────
  function load(){ posts = StorageAPI.load(KEY) || [] }
  function save(){ StorageAPI.save(KEY, posts); render() }
  function nextSeq(){ const n = (parseInt(localStorage.getItem(SEQ_KEY)||'0',10)+1); localStorage.setItem(SEQ_KEY, n); return n }

  // ─── 공통: 데이터 저장 함수 (div composer용) ──────────────
  function savePost(data, parentId = null){
    if(editing){ updatePost(editing.id, data) }
    else{ addPost({...data, parentId: parentId}) }
    document.querySelector('.posts-section').style.visibility = 'visible'
  }
  // popup 콜백용 전역 노출 (항상 새 글 추가)
  window._qa_savePost = function(data){
    addPost({...data, parentId: null})
    document.querySelector('.posts-section').style.visibility = 'visible'
  }

  // ─── 공통: 폼 데이터 수집 ─────────────────────────────────
  function collectFormData(opts){
    const { authorSel, titleEl, contentEl, sexName, cityEl, fruitsName } = opts
    const selectedOpt = authorSel ? authorSel.options[authorSel.selectedIndex] : null
    const sexEl = document.querySelector('input[name="' + sexName + '"]:checked')
    const cityOpt = cityEl.options[cityEl.selectedIndex]
    const fruitsEls = Array.from(document.querySelectorAll('input[name="' + fruitsName + '"]:checked'))
    return {
      author: selectedOpt?.value || '',
      title: titleEl.value.trim(),
      content: contentEl.value.trim(),
      sex: sexEl ? sexEl.value : '',
      city: cityOpt?.value ? cityOpt.text : '',
      fruits: fruitsEls.map(f => f.nextElementSibling?.textContent?.trim() || f.value)
    }
  }

  // ─── 공통: Validation ─────────────────────────────────────
  function validateData(data, requireAuthor = true){
    if(requireAuthor && !data.author){ alert('로그인 사용자를 선택하세요.'); return false }
    if(!data.title){ alert('제목을 입력하세요.'); return false }
    if(!data.content){ alert('내용을 입력하세요.'); return false }
    if(!data.sex){ alert('성별을 선택하세요.'); return false }
    if(!data.fruits.length){ alert('좋아하는 과일을 1개 이상 선택하세요.'); return false }
    if(!data.city){ alert('거주지를 선택하세요.'); return false }
    return true
  }

  // ─── 공통: 5개 필드 초기화 ────────────────────────────────
  function resetFields(opts){
    const { titleEl, contentEl, sexName, cityEl, fruitsName } = opts
    titleEl.value = ''
    contentEl.value = ''
    Array.from(document.querySelectorAll('input[name="' + sexName + '"]')).forEach(r => r.checked = false)
    Array.from(document.querySelectorAll('input[name="' + fruitsName + '"]')).forEach(cb => cb.checked = false)
    cityEl.value = ''
  }

  // ─── CRUD ─────────────────────────────────────────────────
  function addPost({title,author,content,sex='',city='',fruits=[],parentId=null}){
    const p = {id:id(), seq: parentId ? null : nextSeq(), parentId, title, author, content, sex, city, fruits, createdAt:now(), updatedAt:now(), replies:[]}
    if(!parentId){ posts.push(p) }
    else{
      const parent = findPost(parentId)
      parent.replies = parent.replies || []
      parent.replies.push(p)
    }
    save()
  }

  function addComment(parentId, content, author){
    const parent = findPost(parentId)
    if(!parent) return
    parent.replies = parent.replies || []
    parent.replies.push({id:id(), parentId, title:'', author, content, sex:'', city:'', fruits:[], isComment:true, createdAt:now(), updatedAt:now(), replies:[]})
    save()
  }

  function updatePost(postId, data){
    const p = findPost(postId)
    if(!p) return
    Object.assign(p, data)
    p.updatedAt = now()
    save()
  }

  function removePost(postId, parentId=null){
    if(!parentId){ posts = posts.filter(x=>x.id!==postId) }
    else{
      const parent = findPost(parentId)
      if(!parent) return
      parent.replies = (parent.replies||[]).filter(r=>r.id!==postId)
    }
    save()
  }

  function findPost(idToFind, list=posts){
    for(const p of list){ if(p.id===idToFind) return p; const r=findPost(idToFind,p.replies||[]); if(r) return r }
    return null
  }

  // ─── Render ───────────────────────────────────────────────
  function render(){
    postsEl.innerHTML = ''
    const term = searchIn.value.trim().toLowerCase()
    const sorted = posts.slice().sort((a,b)=> sortSelect.value==='old' ? new Date(a.createdAt)-new Date(b.createdAt) : new Date(b.createdAt)-new Date(a.createdAt))
    let count = 0
    for(const p of sorted){ if(renderPostIfMatch(p, postsEl, term, 0, null)) count++ }
    emptyState.style.display = count ? 'none' : 'block'
  }

  function renderPostIfMatch(post, container, term, depth=0, parentId=null){
    if(post.isComment){
      if(!term || post.content.toLowerCase().includes(term)){
        container.appendChild(createCommentNode(post))
        return true
      }
      return false
    }
    const matches = !term || [post.title,post.author,post.content].join(' ').toLowerCase().includes(term)
    const repliesMatch = (post.replies||[]).some(r=>matchRec(r,term))
    if(!matches && !repliesMatch) return false
    container.appendChild(createPostNode(post, depth, parentId))
    for(const r of (post.replies||[])){ renderPostIfMatch(r, container, term, depth + 1, post.id) }
    return true
  }

  function matchRec(p,term){
    if(!term) return true
    if(p.isComment) return p.content.toLowerCase().includes(term)
    if([p.title,p.author,p.content].join(' ').toLowerCase().includes(term)) return true
    return (p.replies||[]).some(r=>matchRec(r,term))
  }

  function createPostNode(post, depth=0, parentId=null){
    const tpl = postTemplate.content.cloneNode(true)
    const tr = tpl.querySelector('.post-row')
    tr.dataset.id = post.id
    if(depth > 0){ tr.classList.add('reply-row'); if(parentId) tr.dataset.parentId = parentId }
    tr.querySelector('.col-num').textContent = post.seq ?? ''
    tr.querySelector('.col-title').textContent = post.title
    tr.querySelector('.col-content').textContent = post.content
    tr.querySelector('.col-author').textContent = post.author
    tr.querySelector('.col-sex').textContent = post.sex === 'M' ? '남자(Male)' : post.sex === 'F' ? '여자(Female)' : ''
    tr.querySelector('.col-city').textContent = post.city || ''
    tr.querySelector('.col-fruits').textContent = (post.fruits||[]).join(' / ')
    tr.querySelector('.created').textContent = fmt(post.updatedAt || post.createdAt)
    const replyBtn = tr.querySelector('.reply')
    if(depth > 0){ replyBtn.remove() }
    else{ replyBtn.addEventListener('click', e=>{ openInlineReplyEditor(post.id, e.target.closest('tr')) }) }
    tr.querySelector('.edit').addEventListener('click', ()=>openDivComposerForEdit(post.id))
    tr.querySelector('.delete').addEventListener('click', ()=>{
      if(confirm('정말 삭제하시겠습니까?')){ removePost(post.id, findParentId(post.id)) }
    })
    return tr
  }

  function createCommentNode(comment){
    const tr = document.createElement('tr')
    tr.className = 'comment-row'
    tr.dataset.id = comment.id
    tr.dataset.parentId = comment.parentId
    const numTd = document.createElement('td'); numTd.className = 'col-num'
    const contentTd = document.createElement('td'); contentTd.className = 'comment-cell'; contentTd.colSpan = 7
    const prefix = document.createElement('span'); prefix.className = 'comment-prefix'; prefix.textContent = '└'
    const contentSpan = document.createElement('span'); contentSpan.className = 'comment-content'; contentSpan.textContent = comment.content
    const meta = document.createElement('span'); meta.className = 'comment-meta'; meta.textContent = comment.author + ' · ' + fmt(comment.createdAt)
    contentTd.append(prefix, contentSpan, meta)
    const actionsTd = document.createElement('td'); actionsTd.className = 'col-actions'
    const deleteBtn = document.createElement('button'); deleteBtn.className = 'delete'; deleteBtn.textContent = '삭제'
    deleteBtn.addEventListener('click', ()=>{ if(confirm('댓글을 삭제하시겠습니까?')) removePost(comment.id, comment.parentId) })
    actionsTd.appendChild(deleteBtn)
    tr.append(numTd, contentTd, actionsTd)
    return tr
  }

  function openInlineReplyEditor(postId, postRow){
    const existing = document.querySelector('.reply-editor-row')
    if(existing) existing.remove()
    let insertAfter = postRow
    let next = postRow.nextElementSibling
    while(next && next.dataset && next.dataset.parentId){ insertAfter = next; next = next.nextElementSibling }
    const editorRow = document.createElement('tr'); editorRow.className = 'reply-editor-row'
    const td = document.createElement('td'); td.colSpan = 9; td.className = 'reply-editor-cell'
    const wrap = document.createElement('div'); wrap.className = 'reply-editor-wrap'
    const textarea = document.createElement('textarea')
    textarea.placeholder = '댓글 내용을 입력하세요'; textarea.rows = 2; textarea.className = 'reply-textarea'
    const actDiv = document.createElement('div'); actDiv.className = 'reply-editor-actions'
    const saveBtn = document.createElement('button'); saveBtn.textContent = '등록'; saveBtn.type = 'button'; saveBtn.className = 'primary'
    const cBtn = document.createElement('button'); cBtn.textContent = '취소'; cBtn.type = 'button'; cBtn.className = 'reply-cancel-btn'
    saveBtn.addEventListener('click', ()=>{
      const c = textarea.value.trim()
      if(!c){ alert('댓글 내용을 입력하세요.'); return }
      const opt = topLoginUser.options[topLoginUser.selectedIndex]
      if(!opt||!opt.value){ alert('로그인 사용자를 선택하세요.'); return }
      addComment(postId, c, opt.value)
    })
    cBtn.addEventListener('click', ()=>{ editorRow.remove() })
    actDiv.append(saveBtn, cBtn); wrap.append(textarea, actDiv); td.appendChild(wrap); editorRow.appendChild(td)
    insertAfter.insertAdjacentElement('afterend', editorRow)
    textarea.focus()
  }

  function findParentId(childId, list=posts, parentId=null){
    for(const p of list){ if(p.id===childId) return parentId; const res = findParentId(childId,p.replies||[], p.id); if(res) return res }
    return null
  }

  // ─── 상단 로그인 사용자 표시 ──────────────────────────────
  function updateLoginUserDisplay(){
    const opt = topLoginUser.options[topLoginUser.selectedIndex]
    if(!opt || !opt.value){ loginUserDisplay.textContent=''; loginUserDisplay.className='topbar-user-info hidden'; return }
    loginUserDisplay.textContent = opt.text
    loginUserDisplay.className = 'topbar-user-info ' + (opt.value === 'changJungIm' ? 'user-red' : 'user-blue')
    const divOpt = Array.from(authorIn.options).find(o=>o.value===opt.value)
    if(divOpt){ authorIn.value=divOpt.value; authorIn.dispatchEvent(new Event('change')) }
  }

  // ─── DIV Composer ─────────────────────────────────────────
  function openDivComposerForNew(){
    editing=null; replyingTo=null
    composerTitle.textContent='게시판 등록(div)'
    postForm.reset()
    const opt = topLoginUser.options[topLoginUser.selectedIndex]
    if(opt?.value){ authorIn.value=opt.value; authorIn.dispatchEvent(new Event('change')) }
    composer.classList.remove('hidden')
    composer.scrollIntoView({behavior:'smooth', block:'start'})
  }

  function openDivComposerForEdit(postId){
    const p=findPost(postId); if(!p) return
    editing={id:postId}; replyingTo=null
    composerTitle.textContent='게시물 수정'
    const opt=Array.from(authorIn.options).find(o=>o.value===p.author)
    if(opt){ authorIn.value=opt.value; authorIn.dispatchEvent(new Event('change')) }
    titleIn.value=p.title; contentIn.value=p.content
    if(p.sex){ const r=document.querySelector('input[name="sex"][value="'+p.sex+'"]'); if(r) r.checked=true }
    const cityOpt=Array.from(cityIn.options).find(o=>o.text===p.city); if(cityOpt) cityIn.value=cityOpt.value
    Array.from(document.querySelectorAll('input[name="fruits"]')).forEach(cb=>{ cb.checked=(p.fruits||[]).includes(cb.nextElementSibling?.textContent?.trim()) })
    composer.classList.remove('hidden')
    composer.scrollIntoView({behavior:'smooth', block:'start'})
  }

  function hideDivComposer(){
    composer.classList.add('hidden')
    editing=null; replyingTo=null
    postForm.reset()
    loginUserBadge.textContent=''; loginUserBadge.className='user-badge'
  }

  postForm.addEventListener('submit', e=>{
    e.preventDefault()
    const data = collectFormData({ authorSel:authorIn, titleEl:titleIn, contentEl:contentIn, sexName:'sex', cityEl:cityIn, fruitsName:'fruits' })
    if(!validateData(data)) return
    const curEditing=editing, curReplyingTo=replyingTo
    setTimeout(()=>{
      savePost(data, curEditing ? null : curReplyingTo)
      alert('게시물이 정상적으로 등록되었습니다.')
      resetFields({ titleEl:titleIn, contentEl:contentIn, sexName:'sex', cityEl:cityIn, fruitsName:'fruits' })
      composer.classList.add('hidden')
      loginUserBadge.textContent=''; loginUserBadge.className='user-badge'
      editing=null; replyingTo=null
    }, 400)
  })

  cancelBtn.addEventListener('click', hideDivComposer)
  authorIn.addEventListener('change', ()=>{
    const opt = authorIn.options[authorIn.selectedIndex]
    if(!opt || !opt.value){ loginUserBadge.textContent=''; loginUserBadge.className='user-badge'; return }
    loginUserBadge.textContent = opt.text
    loginUserBadge.className = 'user-badge ' + (opt.value === 'changJungIm' ? 'red' : 'blue')
  })

  // ─── POPUP ────────────────────────────────────────────────
  function openPopup(){
    const opt = topLoginUser.options[topLoginUser.selectedIndex]
    if(!opt || !opt.value){ alert('로그인 사용자를 선택하세요.'); return }
    const url = 'boardRegPop.html?author=' + encodeURIComponent(opt.value)
    window.open(url, 'boardRegPop', 'width=600,height=500,resizable=no,scrollbars=yes')
  }

  // ─── MODAL ────────────────────────────────────────────────
  function openModal(){
    const opt = topLoginUser.options[topLoginUser.selectedIndex]
    if(!opt || !opt.value){ alert('로그인 사용자를 선택하세요.'); return }
    modalPostForm.reset()
    modalOverlay.classList.remove('hidden')
  }

  function closeModal(){
    modalOverlay.classList.add('hidden')
    modalPostForm.reset()
  }

  modalPostForm.addEventListener('submit', e=>{
    e.preventDefault()
    const opt = topLoginUser.options[topLoginUser.selectedIndex]
    const author = opt?.value || ''
    const data = collectFormData({ authorSel:null, titleEl:modalTitleIn, contentEl:modalContentIn, sexName:'modalSex', cityEl:modalCityIn, fruitsName:'modalFruits' })
    data.author = author
    if(!validateData(data)) return
    setTimeout(()=>{
      addPost({...data, parentId: null})
      alert('게시물이 정상적으로 등록되었습니다.')
      document.querySelector('.posts-section').style.visibility = 'visible'
      closeModal()
    }, 400)
  })

  modalCloseBtn.addEventListener('click', closeModal)
  modalCancelBtn.addEventListener('click', closeModal)
  modalOverlay.addEventListener('click', e=>{ if(e.target===modalOverlay) closeModal() })

  // ─── 버튼 이벤트 ──────────────────────────────────────────
  newPostDivBtn.addEventListener('click', ()=>{
    const opt = topLoginUser.options[topLoginUser.selectedIndex]
    if(!opt || !opt.value){ alert('로그인 사용자를 선택하세요.'); return }
    if(!composer.classList.contains('hidden')){ hideDivComposer() } else { openDivComposerForNew() }
  })
  newPostPopupBtn.addEventListener('click', openPopup)
  newPostModalBtn.addEventListener('click', openModal)
  topLoginUser.addEventListener('change', updateLoginUserDisplay)
  searchIn.addEventListener('input', debounce(render,200))
  sortSelect.addEventListener('change', render)

  // ─── Init ─────────────────────────────────────────────────
  function migrateSeq(){
    let changed = false
    posts.forEach(p=>{ if(!p.seq){ p.seq = nextSeq(); changed = true } })
    if(changed) StorageAPI.save(KEY, posts)
  }
  function seedIfEmpty(){ if(posts.length===0){ addPost({title:'환영합니다',author:'관리자',content:'이곳에 질문을 남기면 답글을 달 수 있습니다. 예시 게시물입니다.',sex:'M',city:'서울특별시',fruits:['귤','배']}) }}
  load(); migrateSeq(); seedIfEmpty(); render()

  window._qa = {load,save,posts,addPost,updatePost,removePost,findPost,render}
})();
