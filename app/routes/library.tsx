import { useState } from "react";
import { useLoaderData, useFetcher, useSearchParams } from "@remix-run/react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { assets as assetsDb } from "~/lib/db.server";
import { UploadZone } from "~/components/UploadZone";
import { AssetCard } from "~/components/AssetCard";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const allAssets = assetsDb.getAll(search);
  return json({ assets: allAssets, search });
}

export default function Library() {
  const { assets, search } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(search);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(searchValue ? { search: searchValue } : {});
  };

  return (
    <div>
      <div className="page-header">
        <h2>Asset Library</h2>
        <p>{assets.length} assets uploaded</p>
      </div>

      <UploadZone />

      <form onSubmit={handleSearch} className="search-bar" style={{ marginTop: 24 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          placeholder="Search by tags..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />
      </form>

      {assets.length === 0 ? (
        <div className="empty-state">
          <h3>No assets yet</h3>
          <p>Drag and drop PNG, JPG, or MP4 files above to get started</p>
        </div>
      ) : (
        <div className="grid grid-4">
          {assets.map((asset: any) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}
