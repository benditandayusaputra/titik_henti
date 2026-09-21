class PanduanAwal {
	terbuka = $state(false);
	pernahDitawarkan = $state(false);

	tawarkanSekali(): void {
		if (this.pernahDitawarkan) return;
		this.pernahDitawarkan = true;
		this.terbuka = true;
	}

	buka(): void {
		this.terbuka = true;
	}

	tutup(): void {
		this.terbuka = false;
	}
}

export const panduan = new PanduanAwal();
