import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads'
import { useAccount } from '../context/AccountContext'

const AD_UNIT_ID = 'ca-app-pub-9760818621347715/4222084139'

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
