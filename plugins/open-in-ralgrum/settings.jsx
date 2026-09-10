const { SwitchItem, Header, Text, Divider } = shelter.ui;
const { HeaderTags, TextTags } = shelter.ui;
import { emitRefresh } from "./marks.js";

function toggle(key) {
  return (value) => {
    shelter.plugin.store[key] = value;
    emitRefresh();
  };
}

export function SettingsPanel() {
  const store = shelter.plugin.store;
  return (
    <>
      <Text tag={TextTags.textSM} style={{ display: "block", "margin-bottom": "8px" }}>
        Plain left-click opens in ralgruM.
        <br />
        Ctrl/Cmd/Shift/Middle-click open in the browser.
      </Text>
      <Text tag={TextTags.textSM} style={{ display: "block", "margin-bottom": "4px" }}>
        If nothing happens, make sure the ralgrum:// protocol is registered.
      </Text>
      <Divider mt mb />
      <Header tag={HeaderTags.H3}>Providers</Header>
      <SwitchItem checked={store.deezer} onChange={toggle("deezer")}>
        Deezer links
      </SwitchItem>
      <SwitchItem checked={store.soundcloud} onChange={toggle("soundcloud")}>
        SoundCloud links
      </SwitchItem>

      <Header tag={HeaderTags.H3}>Link kinds</Header>
      <SwitchItem checked={store.showTracks} onChange={toggle("showTracks")}>
        Tracks
      </SwitchItem>
      <SwitchItem checked={store.showCollections} onChange={toggle("showCollections")}>
        Albums and playlists
      </SwitchItem>
      <SwitchItem checked={store.showArtists} onChange={toggle("showArtists")}>
        Artists
      </SwitchItem>

      <Header tag={HeaderTags.H3}>Behavior</Header>
      <SwitchItem
        note="Toast every time a link is handed to ralgruM."
        checked={store.confirmToast}
        onChange={toggle("confirmToast")}
      >
        Confirm when opening
      </SwitchItem>
    </>
  );
}
