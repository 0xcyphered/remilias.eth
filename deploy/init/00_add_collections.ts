import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deployer, owner } = await getNamedAccounts()

  const collections = [
    '0xabfae8a54e6817f57f9de7796044e9a60e61ad67', // Bonkler
    '0x5af0d9827e0c53e4799bb226655a1de152a425a5', // Milady
    '0x8a45fb65311ac8434aad5b8a93d1eba6ac4e813b', // Milady333
    '0xd3d9ddd0cf0a5f0bfb8f7fceae075df687eaebab', // Remilio
    '0x1352149cd78d686043b504e7e7d96c5946b0c39c', // Banners
    '0x09f66a094a0070ebddefa192a33fa5d75b59d46b', // Yayo
    // '0x8fc0d90f2c45a5e7f94904075c952e0943cfccfd', // Pixelady
    // '0x285ea754d9418073cc87994f1de143f918551390', // Remix
  ]

  const RemiliasRegistrarController = await deployments.get(
    'RemiliasRegistrarController',
  )
  const RemiliasRegistrarControllerContract = await ethers.getContractAt(
    RemiliasRegistrarController.abi,
    RemiliasRegistrarController.address,
  )

  const notAdded = []
  for (let index = 0; index < collections.length; index++) {
    const collection = collections[index]

    const isAdded =
      await RemiliasRegistrarControllerContract.approvedCollections(collection)
    if (!isAdded) {
      notAdded.push(collection)
    }
  }
  if (notAdded.length > 0) {
    const tx = await RemiliasRegistrarControllerContract.addCollections(
      notAdded,
    )
    console.log(
      `Adding collections on registrarController (tx: ${tx.hash})...`,
    )
    await tx.wait()
  }
}

func.id = 'name-wrapper'
func.tags = ['init']
func.dependencies = [
  'RemiliasNameWrapper',
  'RemiliasResolver',
  'RemiliasPublicResolver',
  'RemiliasRegistrarController',
]

export default func
