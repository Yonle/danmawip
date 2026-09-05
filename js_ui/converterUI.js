const menuBar = document.querySelector("#nwMenuBar");

import {
    convertAndDownload,
} from "../js/converter.js";

import {
    createBiliFetcher,
} from "./bilifetch.js";

const converterPlatforms = {
    bilibili: {
        name: "Bilibili",
        accept: ".so",
        hint: "Bilibili DmSegMobileReply Protobuf (.so) file",
        multiple: true,
    },

    niconico: {
        name: "Niconico",
        accept: ".json",
        hint: "Niconico comment JSON file",
        multiple: false,
    },

    youtube: {
        name: "YouTube Live Chat",
        accept: ".json,.jsonl",
        hint: "YouTube live chat JSONL file",
        multiple: false,
    },
};

if (!menuBar) {
    throw new Error('Missing "#nwMenuBar" element.');
}

let activeConverter = null;

function closeMenus() {
    for (const menu of menuBar.querySelectorAll(".menu")) {
        menu.classList.remove("open");
    }
}

function createConverterMenu() {
    const menu = document.createElement("div");

    menu.className = "menu";

    menu.innerHTML = `
        <button
            class="menu-button"
            type="button"
        >
            Converter
        </button>

        <div class="menu-popup">
            <button
                class="menu-item"
                type="button"
                data-platform="bilibili-fetch"
            >
                BilibiliFetch
            </button>

            <button
                class="menu-item"
                type="button"
                data-platform="bilibili"
            >
                Bilibili
            </button>

            <button
                class="menu-item"
                type="button"
                data-platform="niconico"
            >
                Niconico
            </button>

            <button
                class="menu-item"
                type="button"
                data-platform="youtube"
            >
                YouTube Live Chat
            </button>
        </div>
    `;

    menuBar.appendChild(menu);

    return menu;
}

function setupMenu(menu) {
    const button = menu.querySelector(".menu-button");

    button.addEventListener("click", event => {
        event.stopPropagation();

        const open = menu.classList.contains("open");

        closeMenus();

        menu.classList.toggle("open", !open);
    });

    menu.addEventListener("click", event => {
        const item = event.target.closest(".menu-item");

        if (!item) {
            return;
        }

        closeMenus();

        const platform = item.dataset.platform;

        if (platform === "bilibili-fetch") {
            void createBiliFetcher();
            return;
        }

        openConverter(platform);
    });
}

async function createConverterOverlay(platform) {
    const config = converterPlatforms[platform];

    if (!config) {
        throw new Error(`Unknown converter platform: ${platform}`);
    }

    const response = await fetch("./templ/converter.html");

    if (!response.ok) {
        throw new Error(
            `Failed to load converter template: ` +
            `${response.status} ${response.statusText}`
        );
    }

    const html = await response.text();

    const template = document.createElement("template");

    template.innerHTML = html.trim();

    const overlay = template.content.firstElementChild;

    if (!overlay) {
        throw new Error("Converter template is empty.");
    }

    const platformName = overlay.querySelector("#convPName");
    const input = overlay.querySelector("#converterFile");
    const convertButton = overlay.querySelector("#converterButton");
    const cancelButton = overlay.querySelector("#converterCancelButton");
    const status = overlay.querySelector("#converterStatus");
    const fileHint = overlay.querySelector("#converterFileHint");
    const legacyMode = overlay.querySelector("#legacy");

    if (
        !platformName ||
        !input ||
        !convertButton ||
        !cancelButton ||
        !status ||
        !fileHint ||
        !legacyMode
    ) {
        throw new Error(
            "Converter template is missing required elements."
        );
    }

    platformName.textContent = config.name;
    input.accept = config.accept;
    input.multiple = config.multiple;
    fileHint.textContent = config.hint;

    return {
        overlay,
        input,
        legacyMode,
        convertButton,
        cancelButton,
        status,
    };
}

function updateInputText(input) {
    const dropZone = input.closest(".drop-zone");

    if (!dropZone) {
        return;
    }

    const span = dropZone.querySelector("span");

    if (!span) {
        return;
    }

    if (!input.files.length) {
        span.textContent = "Click or drag the comments file here";
        return;
    }

    if (input.files.length === 1) {
        span.textContent = input.files[0].name;
        return;
    }

    span.textContent = `${input.files.length} files selected`;
}

function setupDropZone(input) {
    const dropZone = input.closest(".drop-zone");

    if (!dropZone) {
        return;
    }

    input.addEventListener("change", () => {
        updateInputText(input);
    });

    dropZone.addEventListener("dragover", event => {
        event.preventDefault();

        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", event => {
        if (!dropZone.contains(event.relatedTarget)) {
            dropZone.classList.remove("dragover");
        }
    });

    dropZone.addEventListener("drop", event => {
        event.preventDefault();

        dropZone.classList.remove("dragover");

        const files = [...event.dataTransfer.files];

        if (!files.length) {
            return;
        }

        const transfer = new DataTransfer();

        const selected = input.multiple
            ? files
            : files.slice(0, 1);

        for (const file of selected) {
            transfer.items.add(file);
        }

        input.files = transfer.files;

        updateInputText(input);
    });
}

function closeConverter() {
    if (!activeConverter) {
        return;
    }

    activeConverter.overlay.remove();
    activeConverter = null;
}

function timestamp() {
    const d = new Date();

    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
    ].join("") + "-" + [
        String(d.getHours()).padStart(2, "0"),
        String(d.getMinutes()).padStart(2, "0"),
        String(d.getSeconds()).padStart(2, "0"),
    ].join("");
}

async function openConverter(platform) {
    if (activeConverter) {
        return;
    }

    try {
        const ui = await createConverterOverlay(platform);

        activeConverter = ui;

        ui.overlay.hidden = false;

        document.body.appendChild(ui.overlay);

        setupDropZone(ui.input);

        ui.cancelButton.addEventListener("click", closeConverter);

        ui.convertButton.addEventListener("click", event => {
            event.preventDefault();

            if (!ui.input.files.length) {
                ui.status.textContent = "Please select a file first.";
                return;
            }

            ui.convertButton.disabled = true;
            ui.cancelButton.disabled = true;

            void convertAndDownload(
                platform,
                [...ui.input.files],
                ui.legacyMode.checked,
                `${platform}-${timestamp()}-danma.jsonl.gz`,
                message => {
                    ui.status.textContent = message;
                },
            ).then(
                () => {
                    ui.convertButton.disabled = false;
                    ui.cancelButton.disabled = false;
                },
            ).catch(
                error => {
                    console.error(error);

                    ui.status.textContent =
                        `Conversion failed: ${error.message}`;

                    ui.convertButton.disabled = false;
                    ui.cancelButton.disabled = false;
                },
            );
        });
    } catch (error) {
        console.error("Failed to open converter:", error);
    }
}

const converterMenu = createConverterMenu();

setupMenu(converterMenu);

document.addEventListener("click", event => {
    if (!converterMenu.contains(event.target)) {
        closeMenus();
    }
});