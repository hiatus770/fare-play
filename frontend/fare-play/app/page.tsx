"use client";
import Map from "./components/Map";
import TopNav from "./components/TopNav";

export default function Home() {
  return (
    <>
      <TopNav />
      <div style={{ marginTop: "70px" }}>
        <Map />
      </div>
    </>
  );
}