import {
  App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  normalizePath
} from "obsidian";

type WallpaperFit = "cover" | "contain" | "auto";
type WallpaperPosition = "center" | "top" | "bottom" | "left" | "right";

interface WalloraSettings {
  wallpapers: string[];
  activeWallpaper: string;
  overlay: number;
  imageOpacity: number;
  blur: number;
  fit: WallpaperFit;
  position: WallpaperPosition;
  autoRotate: boolean;
  rotationMinutes: number;
  randomOrder: boolean;
}

const DEFAULT_SETTINGS: WalloraSettings = {
  wallpapers: [],
  activeWallpaper: "",
  overlay: 0.28,
  imageOpacity: 1,
  blur: 0,
  fit: "cover",
  position: "center",
  autoRotate: false,
  rotationMinutes: 30,
  randomOrder: true
};

const WALLPAPER_FOLDER = "Wallora";
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif"]);

export default class WalloraPlugin extends Plugin {
  settings: WalloraSettings;
  private backgroundUrl = "";
  private rotationTimer: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new WalloraSettingTab(this.app, this));
    this.addRibbonIcon("image", "Open Wallora gallery", () => this.openGallery());
    this.addCommand({
      id: "open-gallery",
      name: "Open wallpaper gallery",
      callback: () => this.openGallery()
    });
    this.addCommand({
      id: "next-wallpaper",
      name: "Next wallpaper",
      callback: () => this.nextWallpaper()
    });
    this.addCommand({
      id: "random-wallpaper",
      name: "Set a random wallpaper",
      callback: () => this.setRandomWallpaper()
    });
    this.addCommand({
      id: "toggle-wallpaper",
      name: "Toggle wallpaper visibility",
      callback: () => this.toggleWallpaper()
    });
    await this.applyWallpaper();
    this.configureRotation();
  }

  onunload(): void {
    this.clearRotation();
    document.body.classList.remove("wallora-enabled");
    document.body.style.removeProperty("--wallora-image");
    if (this.backgroundUrl) URL.revokeObjectURL(this.backgroundUrl);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.wallpapers = Array.isArray(this.settings.wallpapers)
      ? this.settings.wallpapers.filter((path): path is string => typeof path === "string")
      : [];
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async addWallpaper(file: File): Promise<void> {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!IMAGE_EXTENSIONS.has(extension) || !file.type.startsWith("image/")) {
      new Notice("Wallora: please choose a supported image file.");
      return;
    }

    await this.app.vault.createFolder(WALLPAPER_FOLDER).catch(() => undefined);
    const safeName = file.name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");
    const path = normalizePath(`${WALLPAPER_FOLDER}/${Date.now()}-${safeName}`);

    try {
      await this.app.vault.createBinary(path, await file.arrayBuffer());
      this.settings.wallpapers.push(path);
      if (!this.settings.activeWallpaper) this.settings.activeWallpaper = path;
      await this.saveSettings();
      await this.applyWallpaper();
      new Notice(`Added “${file.name}” to Wallora.`);
    } catch (error) {
      console.error("Wallora: could not import wallpaper", error);
      new Notice("Wallora could not save this image to your vault.");
    }
  }

  async removeWallpaper(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      try {
        await this.app.vault.delete(file);
      } catch (error) {
        console.error("Wallora: could not delete wallpaper file", error);
        new Notice("Could not remove the image file from your vault.");
        return;
      }
    }

    this.settings.wallpapers = this.settings.wallpapers.filter((item) => item !== path);
    if (this.settings.activeWallpaper === path) {
      this.settings.activeWallpaper = this.settings.wallpapers[0] ?? "";
    }
    await this.saveSettings();
    await this.applyWallpaper();
    new Notice("Wallpaper removed.");
  }

  async setActiveWallpaper(path: string): Promise<void> {
    this.settings.activeWallpaper = path;
    await this.saveSettings();
    await this.applyWallpaper();
    new Notice("Wallpaper applied.");
  }

  async applyWallpaper(): Promise<void> {
    const path = this.settings.activeWallpaper;
    const file = path ? this.app.vault.getAbstractFileByPath(path) : null;

    if (!(file instanceof TFile)) {
      document.body.classList.remove("wallora-enabled");
      document.body.style.removeProperty("--wallora-image");
      if (this.backgroundUrl) URL.revokeObjectURL(this.backgroundUrl);
      this.backgroundUrl = "";
      return;
    }

    try {
      const data = await this.app.vault.readBinary(file);
      const blob = new Blob([data], { type: this.mimeType(file.extension) });
      const nextUrl = URL.createObjectURL(blob);
      if (this.backgroundUrl) URL.revokeObjectURL(this.backgroundUrl);
      this.backgroundUrl = nextUrl;

      const style = document.body.style;
      style.setProperty("--wallora-image", `url("${nextUrl}")`);
      style.setProperty("--wallora-overlay", String(this.settings.overlay));
      style.setProperty("--wallora-opacity", String(this.settings.imageOpacity));
      style.setProperty("--wallora-blur", `${this.settings.blur}px`);
      style.setProperty("--wallora-fit", this.settings.fit);
      style.setProperty("--wallora-position", this.settings.position);
      document.body.classList.add("wallora-enabled");
    } catch (error) {
      console.error("Wallora: could not load wallpaper", error);
      new Notice("Wallora could not load the selected wallpaper.");
    }
  }

  async setRandomWallpaper(): Promise<void> {
    const choices = this.settings.wallpapers.filter((path) => path !== this.settings.activeWallpaper);
    const pool = choices.length ? choices : this.settings.wallpapers;
    if (!pool.length) {
      new Notice("Add an image to your Wallora gallery first.");
      return;
    }
    const next = pool[Math.floor(Math.random() * pool.length)];
    await this.setActiveWallpaper(next);
  }

  async nextWallpaper(): Promise<void> {
    const list = this.settings.wallpapers;
    if (!list.length) {
      new Notice("Your Wallora gallery is empty.");
      return;
    }
    const index = list.indexOf(this.settings.activeWallpaper);
    const nextIndex = index < 0 ? 0 : (index + 1) % list.length;
    await this.setActiveWallpaper(list[nextIndex]);
  }

  async toggleWallpaper(): Promise<void> {
    if (document.body.classList.contains("wallora-enabled")) {
      document.body.classList.remove("wallora-enabled");
      new Notice("Wallpaper hidden.");
    } else if (this.settings.activeWallpaper) {
      await this.applyWallpaper();
    } else {
      new Notice("Choose a wallpaper in the Wallora gallery first.");
    }
  }

  configureRotation(): void {
    this.clearRotation();
    if (!this.settings.autoRotate || this.settings.wallpapers.length < 2) return;
    const minutes = Math.max(1, this.settings.rotationMinutes);
    this.rotationTimer = window.setInterval(() => {
      if (this.settings.randomOrder) void this.setRandomWallpaper();
      else void this.nextWallpaper();
    }, minutes * 60 * 1000);
  }

  private clearRotation(): void {
    if (this.rotationTimer !== null) {
      window.clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  }

  openGallery(): void {
    new WalloraGalleryModal(this.app, this).open();
  }

  private mimeType(extension: string): string {
    const ext = extension.toLowerCase();
    if (ext === "jpg") return "image/jpeg";
    if (ext === "svg") return "image/svg+xml";
    return `image/${ext}`;
  }
}

class WalloraGalleryModal extends Modal {
  private previewUrls: string[] = [];

  constructor(app: App, private plugin: WalloraPlugin) {
    super(app);
    this.modalEl.addClass("wallora-modal");
  }

  onOpen(): void {
    void this.renderGallery();
  }

  onClose(): void {
    this.previewUrls.forEach((url) => URL.revokeObjectURL(url));
    this.previewUrls = [];
    this.contentEl.empty();
  }

  private async renderGallery(): Promise<void> {
    this.previewUrls.forEach((url) => URL.revokeObjectURL(url));
    this.previewUrls = [];
    const { contentEl } = this;
    contentEl.empty();

    const header = contentEl.createDiv({ cls: "wallora-modal-header" });
    header.createEl("h2", { text: "Wallora gallery" });
    const addButton = header.createEl("button", { text: "＋ Add wallpapers", cls: "mod-cta" });
    const fileInput = header.createEl("input", { type: "file" });
    fileInput.type = "file";
    fileInput.accept = "image/png,image/jpeg,image/webp,image/gif,image/avif";
    fileInput.multiple = true;
    fileInput.hidden = true;
    addButton.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const files = Array.from(fileInput.files ?? []);
      for (const file of files) await this.plugin.addWallpaper(file);
      fileInput.value = "";
      await this.renderGallery();
    });

    contentEl.createEl("p", {
      cls: "wallora-modal-description",
      text: "Choose an image to make it your workspace background. Your images are stored locally in the Wallora folder of this vault."
    });

    const gallery = contentEl.createDiv({ cls: "wallora-gallery" });
    const paths = this.plugin.settings.wallpapers;

    if (!paths.length) {
      gallery.createDiv({
        cls: "wallora-empty",
        text: "Your gallery is empty. Add an image to give your workspace a new atmosphere."
      });
      return;
    }

    for (const path of paths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) continue;

      const card = gallery.createDiv({
        cls: `wallora-card${this.plugin.settings.activeWallpaper === path ? " is-active" : ""}`
      });
      const image = card.createEl("img", { attr: { alt: file.basename } });
      try {
        const data = await this.app.vault.readBinary(file);
        const url = URL.createObjectURL(new Blob([data], { type: this.imageMime(file.extension) }));
        this.previewUrls.push(url);
        image.src = url;
      } catch {
        image.alt = "Preview unavailable";
      }

      const meta = card.createDiv({ cls: "wallora-card-meta" });
      meta.createSpan({ cls: "wallora-card-name", text: file.basename });
      const actions = meta.createDiv({ cls: "wallora-card-actions" });
      const apply = actions.createEl("button", {
        text: this.plugin.settings.activeWallpaper === path ? "Active" : "Set wallpaper",
        cls: this.plugin.settings.activeWallpaper === path ? "mod-cta" : ""
      });
      apply.disabled = this.plugin.settings.activeWallpaper === path;
      apply.addEventListener("click", async (event) => {
        event.stopPropagation();
        await this.plugin.setActiveWallpaper(path);
        await this.renderGallery();
      });

      const remove = actions.createEl("button", { text: "Remove" });
      remove.addEventListener("click", async (event) => {
        event.stopPropagation();
        const confirmed = window.confirm(`Remove “${file.basename}” from Wallora and delete its copy from this vault?`);
        if (!confirmed) return;
        await this.plugin.removeWallpaper(path);
        await this.renderGallery();
      });

      card.addEventListener("click", async () => {
        await this.plugin.setActiveWallpaper(path);
        await this.renderGallery();
      });
    }
  }

  private imageMime(extension: string): string {
    const ext = extension.toLowerCase();
    return ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  }
}

class WalloraSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: WalloraPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Wallora" });
    containerEl.createEl("p", {
      text: "Make your Obsidian workspace feel like yours. All wallpaper files stay in this vault."
    });

    new Setting(containerEl)
      .setName("Wallpaper gallery")
      .setDesc(`${this.plugin.settings.wallpapers.length} image(s) in your gallery`)
      .addButton((button) => button
        .setButtonText("Open gallery")
        .setCta()
        .onClick(() => this.plugin.openGallery()));

    new Setting(containerEl)
      .setName("Image opacity")
      .setDesc("Adjust the visibility of the wallpaper.")
      .addSlider((slider) => slider
        .setLimits(0.1, 1, 0.05)
        .setValue(this.plugin.settings.imageOpacity)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.imageOpacity = value;
          await this.plugin.saveSettings();
          await this.plugin.applyWallpaper();
        }));

    new Setting(containerEl)
      .setName("Overlay darkness")
      .setDesc("Add a dark layer above the image to keep text readable.")
      .addSlider((slider) => slider
        .setLimits(0, 0.85, 0.05)
        .setValue(this.plugin.settings.overlay)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.overlay = value;
          await this.plugin.saveSettings();
          await this.plugin.applyWallpaper();
        }));

    new Setting(containerEl)
      .setName("Background blur")
      .setDesc("A subtle blur can help reduce visual distraction.")
      .addSlider((slider) => slider
        .setLimits(0, 20, 1)
        .setValue(this.plugin.settings.blur)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.blur = value;
          await this.plugin.saveSettings();
          await this.plugin.applyWallpaper();
        }));

    new Setting(containerEl)
      .setName("Image sizing")
      .setDesc("Choose how the wallpaper fills the available space.")
      .addDropdown((dropdown) => dropdown
        .addOption("cover", "Fill screen")
        .addOption("contain", "Fit entire image")
        .addOption("auto", "Original size")
        .setValue(this.plugin.settings.fit)
        .onChange(async (value: WallpaperFit) => {
          this.plugin.settings.fit = value;
          await this.plugin.saveSettings();
          await this.plugin.applyWallpaper();
        }));

    new Setting(containerEl)
      .setName("Image position")
      .addDropdown((dropdown) => dropdown
        .addOption("center", "Center")
        .addOption("top", "Top")
        .addOption("bottom", "Bottom")
        .addOption("left", "Left")
        .addOption("right", "Right")
        .setValue(this.plugin.settings.position)
        .onChange(async (value: WallpaperPosition) => {
          this.plugin.settings.position = value;
          await this.plugin.saveSettings();
          await this.plugin.applyWallpaper();
        }));

    containerEl.createEl("h3", { text: "Automatic rotation" });

    new Setting(containerEl)
      .setName("Enable automatic rotation")
      .setDesc("Automatically switch to another wallpaper.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoRotate)
        .onChange(async (value) => {
          this.plugin.settings.autoRotate = value;
          await this.plugin.saveSettings();
          this.plugin.configureRotation();
        }));

    new Setting(containerEl)
      .setName("Rotation interval")
      .setDesc("Time between wallpaper changes, in minutes.")
      .addText((text) => text
        .setPlaceholder("30")
        .setValue(String(this.plugin.settings.rotationMinutes))
        .onChange(async (value) => {
          const parsed = Number.parseInt(value, 10);
          if (!Number.isFinite(parsed) || parsed < 1) return;
          this.plugin.settings.rotationMinutes = Math.min(parsed, 10080);
          await this.plugin.saveSettings();
          this.plugin.configureRotation();
        }));

    new Setting(containerEl)
      .setName("Random order")
      .setDesc("Choose a random image instead of following the gallery order.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.randomOrder)
        .onChange(async (value) => {
          this.plugin.settings.randomOrder = value;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Tip: use the command palette to open the gallery, move to the next wallpaper, choose a random wallpaper, or hide the current background."
    });
  }
}
