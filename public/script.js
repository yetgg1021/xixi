// DOM 元素
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const galleryGrid = document.getElementById('galleryGrid');
const statsDisplay = document.getElementById('statsDisplay');
const clearAllBtn = document.getElementById('clearAllBtn');

// 模态框元素（稍后在 DOM 就绪后初始化）
let modal, modalImg, modalCaption, closeModal;

function initModal() {
    modal = document.getElementById('imageModal');
    modalImg = document.getElementById('modalImg');
    modalCaption = document.getElementById('modalCaption');
    closeModal = document.querySelector('.modal-close');
    if (modal && closeModal) {
        closeModal.addEventListener('click', closeModalFunc);
        window.addEventListener('click', (e) => {
            if (e.target === modal) closeModalFunc();
        });
        console.log('模态框初始化成功');
    } else {
        console.error('模态框元素未找到！请检查 HTML 中是否有 id="imageModal"');
    }
}

function openModal(url, name) {
    if (!modal) {
        console.error('模态框未初始化');
        return;
    }
    modal.style.display = 'block';
    modalImg.src = url;
    modalCaption.innerText = name;
    console.log('模态框已打开', url);
}

function closeModalFunc() {
    if (!modal) return;
    modal.style.display = 'none';
    modalImg.src = '';
}

// 从服务器获取媒体列表并渲染
async function fetchAndRenderMedia() {
    showLoading();
    try {
        const response = await fetch('/api/media');
        if (!response.ok) throw new Error('获取列表失败');
        const mediaList = await response.json();
        renderGallery(mediaList);
        updateStats(mediaList.length);
    } catch (error) {
        console.error('加载失败', error);
        galleryGrid.innerHTML = `<div class="empty-placeholder"><div class="empty-icon">⚠️</div><p>加载失败，请检查网络或刷新页面</p></div>`;
    }
}

function showLoading() {
    galleryGrid.innerHTML = `<div class="loading-spinner">⏳ 加载中...</div>`;
}

function renderGallery(mediaList) {
    if (!mediaList.length) {
        galleryGrid.innerHTML = `<div class="empty-placeholder">
            <div class="empty-icon">🖼️✨</div>
            <p>暂无媒体内容，请点击上方区域上传图片或视频</p>
            <small>支持多选，视频将显示播放控件</small>
        </div>`;
        return;
    }

    const cardsHtml = mediaList.map(item => {
        const isImage = item.type === 'image';
        const previewContent = isImage
            ? `<img src="${item.url}" alt="${item.originalName}" loading="lazy" class="gallery-img" data-url="${item.url}" data-name="${item.originalName}" />`
            : `<video controls preload="metadata" src="${item.url}"></video>`;

        return `
            <div class="media-card" data-id="${item.id}">
                <div class="media-preview">
                    ${previewContent}
                </div>
                <div class="media-info">
                    <span class="media-type">${isImage ? '🖼️ 图片' : '🎬 视频'}</span>
                    <button class="delete-btn" data-id="${item.id}" title="删除">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    galleryGrid.innerHTML = cardsHtml;

    // 绑定删除按钮事件
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            if (confirm('确定要删除这个媒体吗？')) {
                await deleteMedia(id);
                await fetchAndRenderMedia();
            }
        });
    });
}

// 删除单个媒体
async function deleteMedia(id) {
    try {
        const response = await fetch(`/api/media/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('删除失败');
    } catch (error) {
        console.error('删除错误', error);
        alert('删除失败，请重试');
    }
}

function updateStats(count) {
    statsDisplay.textContent = `📦 ${count} 个媒体文件`;
}

async function uploadFiles(files) {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || '上传失败');
        }
        await fetchAndRenderMedia();
    } catch (error) {
        console.error('上传出错', error);
        alert(`上传失败: ${error.message}`);
    }
}

async function clearAllMedia() {
    if (!confirm('⚠️ 清空全部媒体将删除所有图片和视频，不可恢复！确定吗？')) return;
    try {
        const response = await fetch('/api/media', { method: 'DELETE' });
        if (!response.ok) throw new Error('清空失败');
        await fetchAndRenderMedia();
    } catch (error) {
        console.error('清空失败', error);
        alert('清空失败，请重试');
    }
}

// 事件监听（上传相关）
uploadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});

uploadZone.addEventListener('click', (e) => {
    if (e.target === uploadBtn || uploadBtn.contains(e.target)) return;
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        uploadFiles(e.target.files);
        fileInput.value = '';
    }
});

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length) uploadFiles(files);
});

clearAllBtn.addEventListener('click', clearAllMedia);

// 使用事件委托监听图片点击（确保动态加载的图片也能响应）
galleryGrid.addEventListener('click', (e) => {
    let target = e.target;
    if (target.tagName === 'IMG' && target.classList.contains('gallery-img')) {
        e.stopPropagation();
        const url = target.getAttribute('data-url');
        const name = target.getAttribute('data-name');
        console.log('图片被点击（事件委托）', url, name);
        openModal(url, name);
    }
});

// 等待 DOM 完全加载后再初始化模态框和加载数据
document.addEventListener('DOMContentLoaded', () => {
    initModal();
    fetchAndRenderMedia();
});