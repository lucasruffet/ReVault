import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads'
import { useAccount } from '../context/AccountContext'

const AD_UNIT_ID = TestIds.BANNER  // ca-app-pub-3940256099942544/6300978111 (test alias)

export default function AdBanner() {
  const { plan } = useAccount()

  if (plan === 'pro') return null

  return (
    <BannerAd
      unitId={AD_UNIT_ID}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: true }}
    />
  )
}
