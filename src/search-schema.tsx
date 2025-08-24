import { useId, useMemo } from "react";
import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { LocalStorage } from "@raycast/api";

import { showFailureToast, useCachedPromise } from "@raycast/utils";

interface SchemaStoreCatalogItem {
  name: string;
  description: string;
  url: string;
  versions?: Record<string, string>;
  fileMatch?: string[];
}

const SCHEMA_STORE_URL = "https://www.schemastore.org/api/json/catalog.json";

async function fetchSchemaCatalog(): Promise<SchemaStoreCatalogItem[]> {
  try {
    const data = await fetch(SCHEMA_STORE_URL);
    const body = await data.json();
    const schemas = body.schemas as SchemaStoreCatalogItem[];
    return schemas;
  } catch (error) {
    showFailureToast(error, { message: "Error fetching schema catalog" });
    console.error("Error fetching schema catalog:", error);
    return [];
  }
}

async function getFavorites(): Promise<Record<string, SchemaStoreCatalogItem>> {
  try {
    const favorites = await LocalStorage.getItem("favorites");
    if (!favorites) return {};
    const saved = JSON.parse(favorites as string) as Record<string, SchemaStoreCatalogItem>;
    return saved;
  } catch (error) {
    showFailureToast(error, { message: "Error fetching favorites" });
    console.error("Error fetching favorites:", error);
    return {};
  }
}

async function updateFavorites(favorites: Record<string, SchemaStoreCatalogItem>) {
  try {
    await LocalStorage.setItem("favorites", JSON.stringify(favorites));
  } catch (error) {
    showFailureToast(error, { message: "Error updating favorites" });
    console.error("Error updating favorites:", error);
  }
}

function CMActionPanel({ schema }: { schema: SchemaStoreCatalogItem }) {
  const { data: favorites, revalidate } = useCachedPromise(getFavorites);

  const isFavorite = (schema: SchemaStoreCatalogItem) => {
    return favorites && favorites[schema.url] !== undefined;
  };

  const toggleFavorite = async () => {
    if (!favorites) return;
    const newFavorites = { ...favorites };
    if (isFavorite(schema)) {
      delete newFavorites[schema.url];
    } else {
      newFavorites[schema.url] = schema;
    }
    await updateFavorites(newFavorites).then(() => revalidate());
  };

  return (
    <ActionPanel>
      <Action.Paste
        title={"Insert $Schema"}
        content={`"$schema":"${schema.url}"`}
        shortcut={{
          macOS: { modifiers: ["cmd"], key: "i" },
          windows: { modifiers: ["ctrl"], key: "i" },
        }}
      />
      <Action
        title={isFavorite(schema) ? "Remove from Favorites" : "Add to Favorites"}
        icon={isFavorite(schema) ? Icon.Heart : Icon.HeartDisabled}
        onAction={toggleFavorite}
      />
      <Action.CopyToClipboard content={schema.url} />
      <Action.OpenInBrowser url={schema.url} />
    </ActionPanel>
  );
}

function CMListDetails({ schema }: { schema: SchemaStoreCatalogItem }) {
  return (
    <List.Item.Detail
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Name" text={schema.name} />
          <List.Item.Detail.Metadata.Label title="Description" text={schema.description} />
          <List.Item.Detail.Metadata.Separator />
          {schema.fileMatch && schema.fileMatch.length > 0 && (
            <List.Item.Detail.Metadata.TagList title="File Match">
              {schema.fileMatch.map((f) => (
                <List.Item.Detail.Metadata.TagList.Item key={useId()} text={f} />
              ))}
            </List.Item.Detail.Metadata.TagList>
          )}
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Link title="URL" target={schema.url} text={schema.url} />
          {schema.versions && Object.values(schema.versions).length > 0 && (
            <>
              <List.Item.Detail.Metadata.Label title="Versions" />
              {Object.keys(schema.versions).map((k) => (
                <List.Item.Detail.Metadata.Link
                  key={useId()}
                  title={k}
                  text={schema.versions![k]}
                  target={schema.versions![k]}
                />
              ))}
            </>
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
}

export default function Command() {
  const { data: catalogData, isLoading: loadingCatalog } = useCachedPromise(fetchSchemaCatalog);

  const { data: favorites, isLoading: favoritesLoading } = useCachedPromise(getFavorites);

  const isLoading = useMemo(() => {
    return loadingCatalog || favoritesLoading;
  }, [loadingCatalog, favoritesLoading]);

  return (
    <List isLoading={isLoading} isShowingDetail={true}>
      <List.Section title="Favorites">
        {favorites &&
          Object.values(favorites).map((schema) => (
            <List.Item
              key={schema.url}
              title={schema.name}
              subtitle={schema.description}
              detail={<CMListDetails schema={schema} />}
              actions={<CMActionPanel schema={schema} />}
            />
          ))}
      </List.Section>
      <List.Section title="Search Results">
        {catalogData &&
          catalogData.map((schema) => {
            const props: Partial<List.Item.Props> = {
              // detail: (
              //   <List.Item.Detail
              //     metadata={
              //       <List.Item.Detail.Metadata>
              //         <List.Item.Detail.Metadata.Label title="Name" text={schema.name} />
              //         <List.Item.Detail.Metadata.Label title="Description" text={schema.description} />
              //         <List.Item.Detail.Metadata.Separator />
              //         {schema.fileMatch && schema.fileMatch.length > 0 && (
              //           <List.Item.Detail.Metadata.TagList title="File Match">
              //             {schema.fileMatch.map((f) => (
              //               <List.Item.Detail.Metadata.TagList.Item key={useId()} text={f} />
              //             ))}
              //           </List.Item.Detail.Metadata.TagList>
              //         )}
              //         <List.Item.Detail.Metadata.Separator />
              //         <List.Item.Detail.Metadata.Link title="URL" target={schema.url} text={schema.url} />
              //         {schema.versions && Object.values(schema.versions).length > 0 && (
              //           <>
              //             <List.Item.Detail.Metadata.Label title="Versions" />
              //             {Object.keys(schema.versions).map((k) => (
              //               <List.Item.Detail.Metadata.Link
              //                 key={useId()}
              //                 title={k}
              //                 text={schema.versions![k]}
              //                 target={schema.versions![k]}
              //               />
              //             ))}
              //           </>
              //         )}
              //       </List.Item.Detail.Metadata>
              //     }
              //   />
              // ),
              detail: <CMListDetails schema={schema} />,
            };
            // : { accessories: [{ text: schema.versions ? Object.keys(schema.versions)[-1] : "" }] };
            return (
              <List.Item
                key={useId()}
                title={schema.name}
                subtitle={`${schema.description}`}
                {...props}
                actions={
                  <CMActionPanel schema={schema} />
                  // <ActionPanel>
                  //   <Action.CopyToClipboard content={schema.url} />
                  //   <Action.Paste
                  //     title={'Insert "$schema"'}
                  //     content={`"$schema":"${schema.url}"`}
                  //     shortcut={{
                  //       macOS: { modifiers: ["cmd"], key: "i" },
                  //       windows: { modifiers: ["ctrl"], key: "i" },
                  //     }}
                  //   />
                  //   {favorites && (
                  //     <Action
                  //       title={isFavorite(schema) ? "Remove Favorite" : "Add Favorite"}
                  //       onAction={() => {
                  //         if (isFavorite(schema)) {
                  //           delete favorites[schema.url];
                  //         } else {
                  //           favorites[schema.url] = schema;
                  //         }
                  //         updateFavorites(favorites);
                  //       }}
                  //     />
                  //   )}
                  //   <Action.Paste content={schema.url} />
                  //   <Action.OpenInBrowser url={schema.url} />
                  //   {/*<Action title="Toggle Detail" onAction={() => setShowingDetail(!showingDetail)} />*/}
                  // </ActionPanel>
                }
              />
            );
          })}
      </List.Section>
    </List>
  );
}
