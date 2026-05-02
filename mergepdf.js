(function () {
  const state = {
    files: [],
    dragSrcIdx: null,
    currentDownloadUrl: null,
    isInspecting: false,
    isMerging: false,
    nextFileId: 0
  };

  const dropZone = document.getElementById("drop-zone");
  const browseButton = document.getElementById("btn-browse");
  const fileInput = document.getElementById("file-input");
  const fileListEl = document.getElementById("file-list");
  const clearAllButton = document.getElementById("clear-all");
  const outputNameInput = document.getElementById("output-name");
  const summaryStatus = document.getElementById("summary-status");
  const summaryFiles = document.getElementById("summary-files");
  const summarySize = document.getElementById("summary-size");
  const summaryOrder = document.getElementById("summary-order");
  const summaryPages = document.getElementById("summary-pages");
  const btnMerge = document.getElementById("btn-merge");
  const progressWrap = document.getElementById("progress-wrap");
  const progressBar = document.getElementById("progress-bar");
  const progressLabel = document.getElementById("progress-label");
  const errorBox = document.getElementById("error-box");
  const successBox = document.getElementById("success-box");
  const successInfo = document.getElementById("success-info");
  const btnDownload = document.getElementById("btn-download");

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }

  function formatPageCount(pageCount) {
    return pageCount === 1 ? "1 page" : pageCount + " pages";
  }

  function sanitizeFilename(value) {
    const cleaned = value
      .replace(/\.pdf$/i, "")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned || "merged-document";
  }

  function revokeDownloadUrl() {
    if (state.currentDownloadUrl) {
      URL.revokeObjectURL(state.currentDownloadUrl);
      state.currentDownloadUrl = null;
    }

    btnDownload.href = "#";
    btnDownload.removeAttribute("download");
  }

  function revokeReadUrl(entry) {
    if (entry && entry.readUrl) {
      URL.revokeObjectURL(entry.readUrl);
      entry.readUrl = null;
    }
  }

  function revokeAllReadUrls() {
    state.files.forEach(revokeReadUrl);
  }

  function hideFeedback(options = {}) {
    const keepSuccess = Boolean(options.keepSuccess);

    errorBox.textContent = "";
    errorBox.style.display = "none";
    progressWrap.style.display = "none";
    progressBar.style.width = "0%";
    progressLabel.textContent = "Preparing your merge...";

    if (!keepSuccess) {
      successBox.style.display = "none";
    }
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.style.display = "block";
  }

  function setProgress(percent, label) {
    progressWrap.style.display = "block";
    progressBar.style.width = percent + "%";
    progressLabel.textContent = label;
  }

  function setButtonLabel(button, label, options = {}) {
    button.replaceChildren();

    if (options.spinner) {
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      spinner.setAttribute("aria-hidden", "true");
      button.appendChild(spinner);
    }

    const text = document.createElement("span");
    text.textContent = label;
    button.appendChild(text);
  }

  function updateControls() {
    const isBusy = state.isInspecting || state.isMerging;

    browseButton.disabled = isBusy;
    fileInput.disabled = isBusy;
    clearAllButton.disabled = isBusy || state.files.length === 0;
    btnMerge.disabled = isBusy || state.files.length < 2;

    if (state.isInspecting) {
      setButtonLabel(btnMerge, "Reading PDF files", { spinner: true });
    } else if (state.isMerging) {
      setButtonLabel(btnMerge, "Merging PDFs", { spinner: true });
    } else if (state.files.length < 2) {
      setButtonLabel(btnMerge, "Add at least 2 PDFs");
    } else {
      setButtonLabel(btnMerge, "Merge PDFs");
    }
  }

  function updateSummary() {
    const totalBytes = state.files.reduce((sum, entry) => sum + entry.file.size, 0);
    const totalPages = state.files.reduce((sum, entry) => sum + entry.pageCount, 0);

    summaryFiles.textContent = String(state.files.length);
    summarySize.textContent = formatSize(totalBytes);
    summaryPages.textContent = String(totalPages);

    if (state.files.length === 0) {
      summaryOrder.textContent = "Not set";
      summaryStatus.textContent = state.isInspecting
        ? "Reading the selected PDFs..."
        : "Add 1 PDF to read it, or 2 PDFs to merge.";
    } else if (state.isInspecting) {
      summaryOrder.textContent = state.files.length > 1 ? "Custom" : "Single";
      summaryStatus.textContent = "Checking your PDF files and counting pages...";
    } else if (state.isMerging) {
      summaryOrder.textContent = state.files.length > 1 ? "Custom" : "Single";
      summaryStatus.textContent = "Processing your files...";
    } else if (state.currentDownloadUrl && successBox.style.display === "block") {
      summaryOrder.textContent = state.files.length > 1 ? "Custom" : "Single";
      summaryStatus.textContent = "Merged and ready to download.";
    } else if (state.files.length === 1) {
      summaryOrder.textContent = "Single";
      summaryStatus.textContent = "You can read this PDF now, or add 1 more PDF to enable merging.";
    } else {
      summaryOrder.textContent = "Custom";
      summaryStatus.textContent = "Queue looks good. You can merge when ready.";
    }

    clearAllButton.hidden = state.files.length === 0;
    updateControls();
  }

  function ensureReadUrl(entry) {
    if (!entry.readUrl) {
      entry.readUrl = URL.createObjectURL(entry.file);
    }

    return entry.readUrl;
  }

  function openPdfFile(entry) {
    try {
      const url = ensureReadUrl(entry);
      const previewWindow = window.open(url, "_blank", "noopener");

      if (!previewWindow) {
        showError("Your browser blocked the PDF preview tab. Allow pop-ups for this page and try again.");
      }
    } catch (error) {
      showError("The selected PDF could not be opened for reading.");
    }
  }

  function createActionButton(label, className, ariaLabel, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.setAttribute("aria-label", ariaLabel);
    button.disabled = state.isInspecting || state.isMerging;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  function renderFileList() {
    fileListEl.replaceChildren();

    if (state.files.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No files added yet. Drop PDFs above or use the choose files button to start a session.";
      fileListEl.appendChild(empty);
      return;
    }

    state.files.forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "file-item";
      item.draggable = !state.isInspecting && !state.isMerging;
      item.dataset.index = String(index);

      const dragHandle = document.createElement("div");
      dragHandle.className = "drag-handle";
      dragHandle.title = "Drag to reorder";
      dragHandle.textContent = "::";

      const orderBadge = document.createElement("div");
      orderBadge.className = "order-badge";
      orderBadge.textContent = String(index + 1);

      const fileIcon = document.createElement("div");
      fileIcon.className = "file-icon";
      fileIcon.textContent = "PDF";

      const fileInfo = document.createElement("div");
      fileInfo.className = "file-info";

      const fileName = document.createElement("div");
      fileName.className = "file-name";
      fileName.title = entry.file.name;
      fileName.textContent = entry.file.name;

      const fileMeta = document.createElement("div");
      fileMeta.className = "file-meta";
      fileMeta.textContent = formatSize(entry.file.size) + " | " + formatPageCount(entry.pageCount);

      fileInfo.appendChild(fileName);
      fileInfo.appendChild(fileMeta);

      const actions = document.createElement("div");
      actions.className = "file-actions";

      actions.appendChild(
        createActionButton(
          "Read",
          "btn-open",
          "Open " + entry.file.name + " in a new tab",
          () => openPdfFile(entry)
        )
      );

      actions.appendChild(
        createActionButton(
          "\u00D7",
          "btn-remove",
          "Remove " + entry.file.name,
          () => removeFile(index)
        )
      );

      item.appendChild(dragHandle);
      item.appendChild(orderBadge);
      item.appendChild(fileIcon);
      item.appendChild(fileInfo);
      item.appendChild(actions);

      item.addEventListener("dragstart", () => {
        if (state.isInspecting || state.isMerging) {
          return;
        }

        state.dragSrcIdx = index;
        setTimeout(() => item.classList.add("dragging"), 0);
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        state.dragSrcIdx = null;
        document.querySelectorAll(".file-item").forEach((element) => {
          element.classList.remove("drag-target");
        });
      });

      item.addEventListener("dragover", (event) => {
        if (state.isInspecting || state.isMerging) {
          return;
        }

        event.preventDefault();
        document.querySelectorAll(".file-item").forEach((element) => {
          element.classList.remove("drag-target");
        });
        item.classList.add("drag-target");
      });

      item.addEventListener("dragleave", () => {
        item.classList.remove("drag-target");
      });

      item.addEventListener("drop", (event) => {
        if (state.isInspecting || state.isMerging) {
          return;
        }

        event.preventDefault();
        item.classList.remove("drag-target");

        if (state.dragSrcIdx === null || state.dragSrcIdx === index) {
          return;
        }

        const moved = state.files.splice(state.dragSrcIdx, 1)[0];
        state.files.splice(index, 0, moved);
        state.dragSrcIdx = null;
        revokeDownloadUrl();
        hideFeedback();
        render();
      });

      fileListEl.appendChild(item);
    });
  }

  function render() {
    renderFileList();
    updateSummary();
  }

  function getPdfLibrary() {
    if (!window.PDFLib || !window.PDFLib.PDFDocument) {
      throw new Error("The PDF library could not be loaded. Refresh the page and try again.");
    }

    return window.PDFLib.PDFDocument;
  }

  async function inspectPdfFile(file) {
    const PDFDocument = getPdfLibrary();
    const arrayBuffer = await file.arrayBuffer();
    const sourceDocument = await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
      updateMetadata: false
    });

    return {
      id: "pdf-" + state.nextFileId++,
      file,
      pageCount: sourceDocument.getPageCount(),
      readUrl: null
    };
  }

  async function addFiles(incomingFiles) {
    if (state.isInspecting || state.isMerging) {
      return;
    }

    const selectedFiles = incomingFiles.filter(Boolean);
    const pdfs = selectedFiles.filter((file) => {
      return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    });
    const skipped = selectedFiles.length - pdfs.length;
    const issues = [];
    const validEntries = [];

    hideFeedback();

    if (pdfs.length === 0) {
      if (skipped > 0) {
        showError(skipped + " file(s) were skipped because only PDF files are accepted.");
      }
      updateSummary();
      return;
    }

    state.isInspecting = true;
    revokeDownloadUrl();
    updateSummary();
    setProgress(4, "Preparing your PDFs...");

    try {
      for (let index = 0; index < pdfs.length; index += 1) {
        const file = pdfs[index];
        const progress = 8 + Math.round((index / pdfs.length) * 72);
        setProgress(progress, "Reading " + (index + 1) + " of " + pdfs.length + ": " + file.name);

        try {
          validEntries.push(await inspectPdfFile(file));
        } catch (error) {
          issues.push('"' + file.name + '" could not be read. It may be damaged or password-protected.');
        }
      }

      if (validEntries.length > 0) {
        state.files = state.files.concat(validEntries);
        render();
      } else {
        updateSummary();
      }

      if (skipped > 0) {
        issues.unshift(skipped + " file(s) were skipped because only PDF files are accepted.");
      }

      if (issues.length > 0) {
        showError(issues.join(" "));
      }
    } catch (error) {
      showError(error.message || "Something went wrong while reading the selected files.");
    } finally {
      state.isInspecting = false;
      progressWrap.style.display = "none";
      updateSummary();
    }
  }

  function removeFile(index) {
    const entry = state.files[index];

    if (!entry || state.isInspecting || state.isMerging) {
      return;
    }

    revokeReadUrl(entry);
    revokeDownloadUrl();
    state.files.splice(index, 1);
    hideFeedback();
    render();
  }

  function clearAllFiles() {
    if (state.isInspecting || state.isMerging) {
      return;
    }

    revokeAllReadUrls();
    state.files = [];
    state.dragSrcIdx = null;
    hideFeedback();
    revokeDownloadUrl();
    render();
  }

  async function mergePDFs() {
    if (state.files.length < 2 || state.isInspecting || state.isMerging) {
      if (state.files.length < 2 && !state.isInspecting) {
        showError("Add at least 2 PDF files before merging.");
      }
      return;
    }

    state.isMerging = true;
    hideFeedback();
    updateSummary();
    setProgress(4, "Preparing your files...");

    try {
      const PDFDocument = getPdfLibrary();
      const merged = await PDFDocument.create();
      let totalPages = 0;

      for (let index = 0; index < state.files.length; index += 1) {
        const entry = state.files[index];
        const progress = 8 + Math.round((index / state.files.length) * 78);
        setProgress(progress, "Reading " + (index + 1) + " of " + state.files.length + ": " + entry.file.name);

        const arrayBuffer = await entry.file.arrayBuffer();
        let sourceDocument;

        try {
          sourceDocument = await PDFDocument.load(arrayBuffer, {
            ignoreEncryption: true,
            updateMetadata: false
          });
        } catch (error) {
          throw new Error('Could not read "' + entry.file.name + '" during the merge.');
        }

        const copiedPages = await merged.copyPages(sourceDocument, sourceDocument.getPageIndices());
        copiedPages.forEach((page) => {
          merged.addPage(page);
          totalPages += 1;
        });
      }

      setProgress(94, "Saving your merged PDF...");
      const pdfBytes = await merged.save();
      const safeName = sanitizeFilename(outputNameInput.value);
      outputNameInput.value = safeName;

      revokeDownloadUrl();
      state.currentDownloadUrl = URL.createObjectURL(new Blob([pdfBytes], { type: "application/pdf" }));

      btnDownload.href = state.currentDownloadUrl;
      btnDownload.download = safeName + ".pdf";
      successInfo.textContent =
        totalPages +
        " pages from " +
        state.files.length +
        " files are ready as " +
        safeName +
        ".pdf.";

      progressWrap.style.display = "none";
      successBox.style.display = "block";
      summaryStatus.textContent = "Merged and ready to download.";
      successBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      progressWrap.style.display = "none";
      showError(error.message || "Something went wrong while merging the PDFs.");
    } finally {
      state.isMerging = false;
      updateSummary();
    }
  }

  browseButton.addEventListener("click", () => {
    if (!state.isInspecting && !state.isMerging) {
      fileInput.click();
    }
  });

  dropZone.addEventListener("click", (event) => {
    if (event.target.closest("#btn-browse") || state.isInspecting || state.isMerging) {
      return;
    }

    fileInput.click();
  });

  dropZone.addEventListener("keydown", (event) => {
    if (state.isInspecting || state.isMerging) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  dropZone.addEventListener("dragover", (event) => {
    if (state.isInspecting || state.isMerging) {
      return;
    }

    event.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", (event) => {
    const nextTarget = event.relatedTarget;

    if (!nextTarget || !dropZone.contains(nextTarget)) {
      dropZone.classList.remove("drag-over");
    }
  });

  dropZone.addEventListener("drop", (event) => {
    if (state.isInspecting || state.isMerging) {
      return;
    }

    event.preventDefault();
    dropZone.classList.remove("drag-over");
    addFiles(Array.from(event.dataTransfer.files || []));
  });

  fileInput.addEventListener("change", () => {
    addFiles(Array.from(fileInput.files || []));
    fileInput.value = "";
  });

  clearAllButton.addEventListener("click", clearAllFiles);
  btnMerge.addEventListener("click", mergePDFs);

  outputNameInput.addEventListener("input", () => {
    if (state.currentDownloadUrl) {
      btnDownload.download = sanitizeFilename(outputNameInput.value) + ".pdf";
    }
  });

  outputNameInput.addEventListener("blur", () => {
    outputNameInput.value = sanitizeFilename(outputNameInput.value);

    if (state.currentDownloadUrl) {
      btnDownload.download = outputNameInput.value + ".pdf";
    }
  });

  window.addEventListener("beforeunload", () => {
    revokeAllReadUrls();
    revokeDownloadUrl();
  });

  render();
})();
